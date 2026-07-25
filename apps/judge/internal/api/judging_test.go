package api_test

// Container-backed tests for Judging, driven through the judge's own HTTP
// boundary — the same seam the backend uses.
//
// The container runtime is deliberately not stubbed. The entire value of this
// service is that the sandbox limits actually hold, and a stub proves only that
// we can spell the flags. So these tests start real containers running real
// Python, and assert on what the kernel did.
//
// They are slow. `go test -short` skips them; a full `go test ./...` runs them,
// and fails loudly if the container runtime is missing rather than skipping
// quietly — a suite that silently runs nothing is worse than no suite.
//
// Nothing here calls t.Parallel(), which is deliberate. Several of these tests
// assert on wall-clock behaviour — that a timeout fires at its cap, that the
// OOM killer gets there before the clock does — and those assertions are only
// meaningful if the containers under test are not competing with a dozen others
// for the same cores. Running them in parallel made them fail on a developer
// laptop and would have made them flaky on a two-core CI runner.

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Mark-DSouza/god-mode-code/apps/judge/internal/api"
	"github.com/Mark-DSouza/god-mode-code/apps/judge/internal/judging"
	"github.com/Mark-DSouza/god-mode-code/apps/judge/internal/metrics"
	"github.com/Mark-DSouza/god-mode-code/apps/judge/internal/pattern"
	"github.com/Mark-DSouza/god-mode-code/apps/judge/internal/sandbox"
)

// The Pattern these tests judge against: "store what you've seen, look up what
// you need" (ADR-0004). Two Example Tests and four Hidden Tests, so a partially
// correct solution produces counts worth asserting on.
const patternID = "hash-map-seen-lookup"

// A solution that actually implements the technique.
const correctSolution = `def pair_sum(numbers, target):
    seen = {}
    for index, value in enumerate(numbers):
        if target - value in seen:
            return [seen[target - value], index]
        seen[value] = index
    return []
`

var (
	ensureImageOnce sync.Once
	ensureImageErr  error
)

// requireContainerRuntime fails rather than skips when Docker is absent, so
// that a full test run cannot quietly stop proving anything. Use -short to opt
// out on a machine without a container runtime.
func requireContainerRuntime(t *testing.T) {
	t.Helper()
	if testing.Short() {
		t.Skip("container-backed test skipped under -short")
	}
	if _, err := exec.LookPath("docker"); err != nil {
		t.Fatalf("container-backed tests need docker on PATH (use -short to skip): %v", err)
	}

	// The failure is remembered rather than raised inside the Once. t.Fatalf
	// unwinds the calling goroutine, which would leave the Once marked done and
	// every later test failing somewhere else for no visible reason.
	ensureImageOnce.Do(func() {
		if exec.Command("docker", "image", "inspect", sandbox.DefaultImage).Run() == nil {
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()
		out, err := exec.CommandContext(ctx, "docker", "pull", sandbox.DefaultImage).CombinedOutput()
		if err != nil {
			ensureImageErr = fmt.Errorf("pulling %s: %w\n%s", sandbox.DefaultImage, err, out)
		}
	})
	if ensureImageErr != nil {
		t.Fatal(ensureImageErr)
	}
}

// judgeOptions are the knobs a test bends. Everything else stays at the
// production default, because a test against relaxed limits proves nothing.
type judgeOptions struct {
	workers int
	wall    time.Duration
	limits  *sandbox.Limits
}

type judgeUnderTest struct {
	*httptest.Server
	metrics *metrics.Registry
	label   string
}

func startJudging(t *testing.T, opts judgeOptions) judgeUnderTest {
	t.Helper()
	requireContainerRuntime(t)

	if opts.workers == 0 {
		opts.workers = 2
	}
	if opts.wall == 0 {
		opts.wall = 10 * time.Second
	}
	limits := sandbox.DefaultLimits()
	if opts.limits != nil {
		limits = *opts.limits
	}
	limits.Wall = opts.wall

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	registry := metrics.NewRegistry("test")

	runner := sandbox.New(sandbox.Options{
		Limits:  limits,
		Logger:  log,
		Metrics: registry,
	})
	t.Cleanup(func() { _ = runner.Close() })

	catalogue, err := pattern.Embedded()
	if err != nil {
		t.Fatalf("loading the Pattern catalogue: %v", err)
	}

	judge := judging.New(judging.Options{
		Sandbox:  runner,
		Patterns: catalogue,
		Workers:  opts.workers,
		Logger:   log,
		Metrics:  registry,
	})

	server := httptest.NewServer(api.New("test",
		api.WithLogger(log),
		api.WithJudge(judge),
		api.WithMetrics(registry),
	).Handler())
	t.Cleanup(server.Close)

	return judgeUnderTest{Server: server, metrics: registry, label: runner.Label()}
}

// judge posts submitted source and returns the Verdict.
func (j judgeUnderTest) judge(t *testing.T, source string) judging.Judging {
	t.Helper()
	response := j.post(t, patternID, source)
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(response.Body)
		t.Fatalf("POST /judgings status = %d, want 200: %s", response.StatusCode, body)
	}
	var judged judging.Judging
	if err := json.NewDecoder(response.Body).Decode(&judged); err != nil {
		t.Fatalf("decoding the Verdict: %v", err)
	}
	return judged
}

func (j judgeUnderTest) post(t *testing.T, id, source string) *http.Response {
	t.Helper()
	body, err := json.Marshal(judging.Request{PatternID: id, Source: source})
	if err != nil {
		t.Fatalf("encoding the request: %v", err)
	}
	response, err := http.Post(j.URL+"/judgings", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("POST /judgings: %v", err)
	}
	return response
}

func TestCorrectSolutionPasses(t *testing.T) {
	judge := startJudging(t, judgeOptions{})

	started := time.Now()
	judged := judge.judge(t, correctSolution)
	t.Logf("Judging took %s", time.Since(started))

	if judged.Verdict != judging.VerdictPassed {
		t.Errorf("verdict = %q (detail %q), want %q", judged.Verdict, judged.Detail, judging.VerdictPassed)
	}
	if judged.TestsPassed != judged.TestsTotal {
		t.Errorf("testsPassed = %d, want all %d", judged.TestsPassed, judged.TestsTotal)
	}
	if judged.TestsTotal != 6 {
		t.Errorf("testsTotal = %d, want 6", judged.TestsTotal)
	}
	if judged.DurationMillis <= 0 {
		t.Errorf("durationMillis = %d, want a positive duration", judged.DurationMillis)
	}
	if judged.Detail != "" {
		t.Errorf("detail = %q, want empty for a Passed Verdict", judged.Detail)
	}
}

// A second Pattern, from a different Family with a different entry point and a
// different shape of answer. It is here so the catalogue is exercised as a
// catalogue: a judge that had the first Pattern's tests baked in anywhere would
// pass every other test in this file and fail this one.
func TestASecondPatternIsJudgedOnItsOwnTests(t *testing.T) {
	judge := startJudging(t, judgeOptions{})

	const source = `def longest_unique(text):
    seen = {}
    best = left = 0
    for right, character in enumerate(text):
        if character in seen and seen[character] >= left:
            left = seen[character] + 1
        seen[character] = right
        best = max(best, right - left + 1)
    return best
`
	response := judge.post(t, "sliding-window-longest-unique", source)
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", response.StatusCode)
	}
	var judged judging.Judging
	if err := json.NewDecoder(response.Body).Decode(&judged); err != nil {
		t.Fatalf("decoding the Verdict: %v", err)
	}

	if judged.Verdict != judging.VerdictPassed {
		t.Errorf("verdict = %q (detail %q), want %q", judged.Verdict, judged.Detail, judging.VerdictPassed)
	}
	if judged.PatternID != "sliding-window-longest-unique" {
		t.Errorf("patternId = %q, want the Pattern that was asked for", judged.PatternID)
	}
	if judged.TestsPassed != 6 || judged.TestsTotal != 6 {
		t.Errorf("counts = %d/%d, want 6/6", judged.TestsPassed, judged.TestsTotal)
	}
}

// A realistic mistake: the right technique, but it returns the values it
// summed instead of their indices. Every test that finds a pair therefore
// fails, and the one that finds none passes — 1 of 6.
const wrongSolution = `def pair_sum(numbers, target):
    seen = {}
    for index, value in enumerate(numbers):
        if target - value in seen:
            return [value, target - value]
        seen[value] = index
    return []
`

func TestIncorrectSolutionFailsWithAccurateCounts(t *testing.T) {
	judge := startJudging(t, judgeOptions{})

	judged := judge.judge(t, wrongSolution)

	if judged.Verdict != judging.VerdictFailed {
		t.Errorf("verdict = %q (detail %q), want %q", judged.Verdict, judged.Detail, judging.VerdictFailed)
	}
	if judged.TestsTotal != 6 {
		t.Errorf("testsTotal = %d, want 6", judged.TestsTotal)
	}
	// The count is the point: exactly one of the six tests — "no pair sums to
	// the target" — survives returning values instead of indices.
	if judged.TestsPassed != 1 {
		t.Errorf("testsPassed = %d, want exactly 1", judged.TestsPassed)
	}

	// An Example Test's failure is revealed in full; a Hidden Test's is only
	// ever a count (CONTEXT.md). The revealed failure must therefore name the
	// Example Test, and nothing in the response may quote a Hidden Test.
	if !strings.Contains(judged.Detail, "the pair is the first two numbers") {
		t.Errorf("detail = %q, want it to reveal the failing Example Test", judged.Detail)
	}
	for _, hidden := range []string{
		"the pair is not the first two numbers",
		"the same value twice",
		"negative numbers",
		"the pair is at the end of a long input",
	} {
		if strings.Contains(judged.Detail, hidden) {
			t.Errorf("detail leaked the Hidden Test %q: %s", hidden, judged.Detail)
		}
	}
}

func TestSourceThatDoesNotCompileIsAnError(t *testing.T) {
	judge := startJudging(t, judgeOptions{})

	judged := judge.judge(t, "def pair_sum(numbers, target)\n    return [\n")

	if judged.Verdict != judging.VerdictError {
		t.Errorf("verdict = %q, want %q", judged.Verdict, judging.VerdictError)
	}
	// Nothing ran, so nothing passed — but the player still sees what they
	// were being judged against.
	if judged.TestsPassed != 0 || judged.TestsTotal != 6 {
		t.Errorf("counts = %d/%d, want 0/6", judged.TestsPassed, judged.TestsTotal)
	}
	if !strings.Contains(judged.Detail, "SyntaxError") {
		t.Errorf("detail = %q, want it to name the syntax error", judged.Detail)
	}
}

// runningContainers counts the containers this judge's sandbox started that are
// still alive — asked of Docker directly, not of the judge's own bookkeeping.
// A judge that has lost track of a container would happily report zero.
//
// It returns an error rather than calling t.Fatalf because it is also called
// from a watcher goroutine, and FailNow from a goroutine other than the test's
// own unwinds that goroutine while the test waits for it forever.
func (j judgeUnderTest) runningContainers() (int, error) {
	out, err := exec.Command("docker", "ps", "--quiet", "--filter", "label="+j.label).Output()
	if err != nil {
		return 0, fmt.Errorf("listing sandbox containers: %w", err)
	}
	return len(strings.Fields(string(out))), nil
}

// mustCountContainers is the test-goroutine-only convenience.
func (j judgeUnderTest) mustCountContainers(t *testing.T) int {
	t.Helper()
	running, err := j.runningContainers()
	if err != nil {
		t.Fatal(err)
	}
	return running
}

// An infinite loop that also refuses to be asked nicely: it ignores SIGTERM and
// SIGINT, so nothing short of SIGKILL from outside ends it, and it never checks
// a clock of its own. If the judge did not own the deadline, this request would
// never come back.
const wedgedSolution = `import signal

signal.signal(signal.SIGTERM, signal.SIG_IGN)
signal.signal(signal.SIGINT, signal.SIG_IGN)


def pair_sum(numbers, target):
    while True:
        pass
`

func TestInfiniteLoopTimesOutInsteadOfHanging(t *testing.T) {
	const wall = 3 * time.Second
	judge := startJudging(t, judgeOptions{wall: wall})

	started := time.Now()
	judged := judge.judge(t, wedgedSolution)
	elapsed := time.Since(started)
	t.Logf("wedged container answered in %s (wall-clock cap %s)", elapsed, wall)

	if judged.Verdict != judging.VerdictTimeout {
		t.Errorf("verdict = %q (detail %q), want %q", judged.Verdict, judged.Detail, judging.VerdictTimeout)
	}
	// It really did run to the cap rather than failing early for some other
	// reason — otherwise this test would pass against a judge that simply
	// could not start containers.
	if elapsed < wall {
		t.Errorf("answered in %s, before the %s cap — the loop cannot have run", elapsed, wall)
	}
	// And the request was answered on the judge's schedule, not the
	// container's. The slack covers container teardown, not waiting for it:
	// the judge hands the container to the reaper and replies immediately.
	if slack := 5 * time.Second; elapsed > wall+slack {
		t.Errorf("answered in %s, more than %s after the %s cap — the request waited on the container",
			elapsed, slack, wall)
	}

	// The container that outlived its request must not outlive the judge's
	// attention either.
	deadline := time.Now().Add(20 * time.Second)
	for judge.mustCountContainers(t) > 0 {
		if time.Now().After(deadline) {
			t.Fatalf("a sandbox container was still running 20s after its request was answered")
		}
		time.Sleep(200 * time.Millisecond)
	}
}

// Allocates in chunks and touches every byte, so the pages are really resident
// and the memory cgroup really has to account for them. Overcommit means a
// bytearray that is never written to may cost nothing at all.
const memoryHogSolution = `def pair_sum(numbers, target):
    hoard = []
    while True:
        hoard.append(bytearray(16 * 1024 * 1024))
`

func TestMemoryExhaustionIsContained(t *testing.T) {
	const wall = 20 * time.Second
	judge := startJudging(t, judgeOptions{wall: wall})

	started := time.Now()
	judged := judge.judge(t, memoryHogSolution)
	elapsed := time.Since(started)
	t.Logf("memory hog answered in %s: %s / %s", elapsed, judged.Verdict, judged.Detail)

	if judged.Verdict != judging.VerdictError {
		t.Errorf("verdict = %q (detail %q), want %q", judged.Verdict, judged.Detail, judging.VerdictError)
	}
	if !strings.Contains(judged.Detail, "memory cap") {
		t.Errorf("detail = %q, want it to name the memory cap", judged.Detail)
	}
	// The kernel ended this, not the clock. If the wall-clock cap were what
	// stopped it, the memory cap would not be doing anything and a runaway
	// allocation would spend its whole budget thrashing the host.
	if elapsed >= wall {
		t.Errorf("answered in %s, at or past the %s cap — the OOM killer did not stop this", elapsed, wall)
	}
}

// Prints without bound. A memory cap does nothing about this: the bytes leave
// the process as fast as they are made, and it is the host that pays.
const noisySolution = `def pair_sum(numbers, target):
    line = "x" * 1024
    while True:
        print(line)
`

func TestUnboundedOutputIsTruncated(t *testing.T) {
	const wall = 20 * time.Second
	judge := startJudging(t, judgeOptions{wall: wall})

	started := time.Now()
	judged := judge.judge(t, noisySolution)
	elapsed := time.Since(started)
	t.Logf("print loop answered in %s: %s / %s", elapsed, judged.Verdict, judged.Detail)

	if judged.Verdict != judging.VerdictError {
		t.Errorf("verdict = %q (detail %q), want %q", judged.Verdict, judged.Detail, judging.VerdictError)
	}
	if !strings.Contains(judged.Detail, "output") {
		t.Errorf("detail = %q, want it to name the output cap", judged.Detail)
	}
	// Stopped by the cap, not by the clock — the same distinction as the
	// memory test, and the reason the cap is worth having.
	if elapsed >= wall {
		t.Errorf("answered in %s, at or past the %s cap — the output cap did not stop this", elapsed, wall)
	}

	// And the judge says so where an operator can see it, which is the only
	// place it can: this host cannot ship telemetry anywhere (ADR-0005).
	response, err := http.Get(judge.URL + "/metrics")
	if err != nil {
		t.Fatalf("GET /metrics: %v", err)
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(response.Body)
	if !strings.Contains(string(body), "judge_output_truncated_total 1") {
		t.Errorf("/metrics did not record the truncation:\n%s", body)
	}
}

// Reaches for the network from inside the sandbox. --network=none means there
// is no route to fail to use — there is no stack at all beyond loopback.
const networkSolution = `import socket


def pair_sum(numbers, target):
    socket.create_connection(("1.1.1.1", 80), timeout=5)
    return []
`

func TestNetworkCallFails(t *testing.T) {
	judge := startJudging(t, judgeOptions{})

	judged := judge.judge(t, networkSolution)
	t.Logf("network attempt: %s / %s", judged.Verdict, judged.Detail)

	if judged.Verdict != judging.VerdictFailed {
		t.Errorf("verdict = %q (detail %q), want %q", judged.Verdict, judged.Detail, judging.VerdictFailed)
	}
	// Every test calls the entry point, so every test dies on the same socket.
	if judged.TestsPassed != 0 {
		t.Errorf("testsPassed = %d, want 0 — something reached the network", judged.TestsPassed)
	}
	// The failure the player is shown must be the network one, not a timeout:
	// the connection is refused by the absence of a route, immediately, rather
	// than hanging until the five-second connect timeout or the wall clock.
	if !strings.Contains(strings.ToLower(judged.Detail), "unreachable") {
		t.Errorf("detail = %q, want the connection to have failed as unreachable", judged.Detail)
	}
}

// Correct, but slow enough to still be running when its neighbours arrive.
// The sleep is at import time so every execution occupies its worker for a
// predictable stretch regardless of how many tests it gets through.
const slowSolution = `import time

time.sleep(2)


def pair_sum(numbers, target):
    seen = {}
    for index, value in enumerate(numbers):
        if target - value in seen:
            return [seen[target - value], index]
        seen[value] = index
    return []
`

func TestConcurrentJudgingsStayWithinThePoolBound(t *testing.T) {
	const (
		workers  = 2
		requests = 6
	)
	judge := startJudging(t, judgeOptions{workers: workers, wall: 30 * time.Second})

	// Watch Docker, not the judge. The judge reporting that it kept to its own
	// bound is not evidence; the number of containers actually alive is.
	//
	// Neither this goroutine nor the request goroutines below may call t.Fatalf:
	// FailNow from a goroutine other than the test's own unwinds only that
	// goroutine, and the test would then wait on a WaitGroup that never
	// finishes. They report back over channels and the test does the asserting.
	watching := make(chan struct{})
	observed := make(chan int, 1)
	watchErr := make(chan error, 1)
	go func() {
		peak := 0
		defer func() { observed <- peak }()
		for {
			select {
			case <-watching:
				return
			default:
			}
			running, err := judge.runningContainers()
			if err != nil {
				watchErr <- err
				return
			}
			if running > peak {
				peak = running
			}
			time.Sleep(25 * time.Millisecond)
		}
	}()

	type outcome struct {
		judged judging.Judging
		err    error
	}
	outcomes := make(chan outcome, requests)
	var wg sync.WaitGroup
	started := time.Now()
	for range requests {
		wg.Add(1)
		go func() {
			defer wg.Done()
			body, err := json.Marshal(judging.Request{PatternID: patternID, Source: slowSolution})
			if err != nil {
				outcomes <- outcome{err: err}
				return
			}
			response, err := http.Post(judge.URL+"/judgings", "application/json", bytes.NewReader(body))
			if err != nil {
				outcomes <- outcome{err: err}
				return
			}
			defer response.Body.Close()
			if response.StatusCode != http.StatusOK {
				outcomes <- outcome{err: fmt.Errorf("status = %d, want 200", response.StatusCode)}
				return
			}
			var judged judging.Judging
			if err := json.NewDecoder(response.Body).Decode(&judged); err != nil {
				outcomes <- outcome{err: err}
				return
			}
			outcomes <- outcome{judged: judged}
		}()
	}
	wg.Wait()
	elapsed := time.Since(started)
	close(watching)
	peak := <-observed

	select {
	case err := <-watchErr:
		t.Fatalf("watching sandbox containers: %v", err)
	default:
	}

	t.Logf("%d requests through %d workers took %s, peak containers %d", requests, workers, elapsed, peak)

	if peak > workers {
		t.Errorf("peak of %d containers ran at once, more than the pool bound of %d", peak, workers)
	}
	// Without this the test would pass against a judge that serialised
	// everything, or one that never started a container at all.
	if peak < workers {
		t.Errorf("peak of %d containers, want the pool to actually reach %d — the test proved nothing", peak, workers)
	}

	close(outcomes)
	for got := range outcomes {
		if got.err != nil {
			t.Errorf("a queued Solve Run did not complete: %v", got.err)
			continue
		}
		if got.judged.Verdict != judging.VerdictPassed {
			t.Errorf("verdict = %q, want every queued Solve Run to be judged normally", got.judged.Verdict)
		}
	}

	// Queueing, not dropping: six two-second executions cannot have gone
	// through two workers in less than three rounds.
	if minimum := 3 * 2 * time.Second; elapsed < minimum {
		t.Errorf("finished in %s, faster than the %s that %d workers physically allow",
			elapsed, minimum, workers)
	}
}

func TestHealthReportsUpWithAContainerRuntime(t *testing.T) {
	judge := startJudging(t, judgeOptions{})

	response, err := http.Get(judge.URL + "/health")
	if err != nil {
		t.Fatalf("GET /health: %v", err)
	}
	defer response.Body.Close()

	var health api.Health
	if err := json.NewDecoder(response.Body).Decode(&health); err != nil {
		t.Fatalf("decoding body: %v", err)
	}
	if health.Status != api.StatusUp {
		t.Errorf("status = %q, want %q", health.Status, api.StatusUp)
	}
	if !health.Judging {
		t.Error("judging = false, want true with a container runtime")
	}
}

func TestUnknownPatternIsNotFound(t *testing.T) {
	judge := startJudging(t, judgeOptions{})

	response := judge.post(t, "no-such-pattern", correctSolution)
	defer response.Body.Close()

	if response.StatusCode != http.StatusNotFound {
		t.Errorf("status = %d, want %d", response.StatusCode, http.StatusNotFound)
	}
	if judge.mustCountContainers(t) != 0 {
		t.Error("an unknown Pattern started a container")
	}
}

// probeSource asks the sandbox about itself from the inside.
//
// The other tests prove limits by tripping them, which is the strongest kind of
// evidence but only reaches the limits something can actually trip. This reads
// the rest straight out of the kernel's own accounting — the cgroup files and
// /proc/self/status — so "all capabilities dropped" is checked against
// CapEff rather than against the flag we believe we passed.
//
// It reports by failing: the entry point raises with SANDBOX[...], the failure
// belongs to an Example Test so it is revealed in full, and an empty bracket
// means every property held.
const probeSource = `import os
import subprocess


def _read(path):
    try:
        with open(path) as handle:
            return handle.read().strip()
    except OSError as error:
        return "unreadable: %%s" %% error


def _findings():
    problems = []

    if os.getuid() == 0 or os.geteuid() == 0:
        problems.append("running as root")

    # A read-only root filesystem, with exactly one writable path.
    try:
        with open("/probe", "w"):
            pass
        problems.append("the root filesystem is writable")
    except OSError:
        pass
    try:
        with open("/tmp/probe", "w"):
            pass
    except OSError as error:
        problems.append("the tmpfs is not writable: %%s" %% error)

    # ...which is size-limited, so filling it cannot fill the host.
    try:
        with open("/tmp/big", "wb") as handle:
            chunk = b"\x00" * (1024 * 1024)
            for _ in range(64):
                handle.write(chunk)
            handle.flush()
        problems.append("the tmpfs is not size-limited")
    except OSError:
        pass
    try:
        os.unlink("/tmp/big")
    except OSError:
        pass

    # ...and cannot execute what is written to it.
    try:
        with open("/tmp/probe.sh", "w") as handle:
            handle.write("#!/bin/sh\nexit 0\n")
        os.chmod("/tmp/probe.sh", 0o755)
        subprocess.run(["/tmp/probe.sh"], check=False)
        problems.append("the tmpfs is executable")
    except PermissionError:
        pass
    except OSError:
        pass

    checks = {
        "/sys/fs/cgroup/memory.max": "%[1]d",
        "/sys/fs/cgroup/memory.swap.max": "0",
        "/sys/fs/cgroup/pids.max": "%[2]d",
    }
    for path, expected in checks.items():
        actual = _read(path)
        if actual != expected:
            problems.append("%%s is %%s, expected %%s" %% (path, actual, expected))

    # CPU is capped as a fraction of a core, so the exact quota depends on the
    # setting; what must never be true is that there is no cap at all.
    if _read("/sys/fs/cgroup/cpu.max").split()[0] == "max":
        problems.append("cpu is not capped")

    for line in _read("/proc/self/status").splitlines():
        if line.startswith("CapEff:") and line.split()[1].strip("0"):
            problems.append("capabilities not dropped: %%s" %% line.strip())
        if line.startswith("NoNewPrivs:") and line.split()[1] != "1":
            problems.append("privilege escalation allowed: %%s" %% line.strip())

    # --network=none leaves loopback and nothing else.
    interfaces = []
    for line in _read("/proc/net/dev").splitlines()[2:]:
        interfaces.append(line.split(":")[0].strip())
    if [name for name in interfaces if name != "lo"]:
        problems.append("network interfaces present: %%s" %% ",".join(interfaces))

    return problems


def pair_sum(numbers, target):
    raise AssertionError("SANDBOX[" + ";".join(_findings()) + "]")
`

func TestSandboxLimitsAreActuallyInForce(t *testing.T) {
	limits := sandbox.DefaultLimits()
	judge := startJudging(t, judgeOptions{})

	source := fmt.Sprintf(probeSource, memoryBytes(t, limits.Memory), limits.Pids)
	judged := judge.judge(t, source)
	t.Logf("sandbox probe: %s", judged.Detail)

	if judged.Verdict != judging.VerdictFailed {
		t.Fatalf("verdict = %q (detail %q), want %q — the probe did not run",
			judged.Verdict, judged.Detail, judging.VerdictFailed)
	}
	// An empty bracket is the pass. Anything between the brackets is a limit
	// the kernel is not applying, named by the container that looked.
	if !strings.Contains(judged.Detail, "SANDBOX[]") {
		t.Errorf("the sandbox did not hold every limit: %s", judged.Detail)
	}
}

// memoryBytes turns a Docker size string such as "128m" into bytes, so the
// probe compares the cgroup against what the judge actually asked for rather
// than a number copied into the test.
func memoryBytes(t *testing.T, size string) int64 {
	t.Helper()
	units := map[string]int64{"b": 1, "k": 1 << 10, "m": 1 << 20, "g": 1 << 30}
	scale, ok := units[strings.ToLower(size[len(size)-1:])]
	if !ok {
		t.Fatalf("cannot read the memory limit %q", size)
	}
	amount, err := strconv.ParseInt(size[:len(size)-1], 10, 64)
	if err != nil {
		t.Fatalf("cannot read the memory limit %q: %v", size, err)
	}
	return amount * scale
}

// Guards against the whole suite passing because every assertion is reading a
// hard-coded zero. Not a scenario from the issue — a canary for the others.
func TestMetricsCountJudgings(t *testing.T) {
	judge := startJudging(t, judgeOptions{})

	judge.judge(t, correctSolution)

	response, err := http.Get(judge.URL + "/metrics")
	if err != nil {
		t.Fatalf("GET /metrics: %v", err)
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(response.Body)

	if !strings.Contains(string(body), `judge_judgings_total{verdict="passed"} 1`) {
		t.Errorf("/metrics did not count the Passed Judging:\n%s", body)
	}
}
