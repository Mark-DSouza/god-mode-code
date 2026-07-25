// Package sandbox runs one untrusted program in one throwaway container.
//
// It knows nothing about Patterns or Verdicts. It takes a Python program, runs
// it under every limit the kernel will give us, and reports what happened —
// including the ways the limits stopped it.
//
// Two things here are load-bearing and easy to get wrong:
//
// The wall-clock timeout is enforced *here*, by the supervising process, not by
// the container. Nothing inside a container can be trusted to end itself; a
// program that wedges the interpreter, or one that simply spins, has no reason
// to cooperate. So the deadline lives in a timer this process owns, and when it
// fires the request is answered immediately and the container is handed to the
// reaper. The request never waits on the container's death.
//
// Output is capped by the reader, not by the container. A memory cap does not
// stop `while True: print("x")` — the bytes leave the process as fast as they
// are produced, and it is the *host* that pays, in log files and disk. So the
// container writes to no log driver at all, and the pipe reader stops
// collecting past a fixed cap and kills the container that overran it.
package sandbox

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Mark-DSouza/god-mode-code/apps/judge/internal/metrics"
)

// DefaultImage is the execution image. Alpine keeps it small, and small matters
// on an instance sized for a process supervisor rather than a fleet.
const DefaultImage = "python:3.13-alpine"

// The unprivileged uid/gid present in essentially every base image. Running as
// a named user would mean trusting the image's passwd file; a numeric id needs
// no lookup and cannot resolve to root by accident.
const nobodyUser = "65534:65534"

// Anything the harness writes past this is a bug in the harness, not a player's
// program. Bounded so a broken harness cannot become a second memory leak.
const maxReportBytes = 64 << 10

// dockerCommand is the container runtime client. Not configurable: the judge is
// deployed onto one machine that this project provisions, and a runtime this
// service has never been tested against is not a setting worth offering.
const dockerCommand = "docker"

// sweepInterval is how often abandoned containers are swept up. Frequent enough
// that a crash does not leave a container holding memory for long, rare enough
// that an idle judge is not talking to the daemon constantly.
const sweepInterval = 30 * time.Second

// Limits are the caps applied to every execution.
type Limits struct {
	// Memory is a Docker size string. Swap is pinned to the same value, which
	// is how you disable swap: with --memory-swap equal to --memory, the swap
	// allowance is zero, so a program cannot trade the memory cap for disk and
	// spend its whole timeout thrashing.
	Memory string
	// CPUs is a fraction of a core. A capped share, not a pinned core, so one
	// spinning Solve Run cannot starve the others.
	CPUs string
	// Pids caps process and thread count, which is what actually stops a fork
	// bomb — a memory cap alone does not, because each child is cheap.
	Pids int
	// TmpfsSize bounds the only writable path in the container. The tmpfs is
	// charged to the container's own memory cgroup, so filling it hits the
	// memory cap rather than the host's disk.
	TmpfsSize string
	// MaxOutputBytes caps what the supervisor will collect from one execution.
	MaxOutputBytes int64
	// Wall is the deadline this process enforces on the container.
	Wall time.Duration
}

// DefaultLimits are what production runs. Tests bend Wall and nothing else,
// because a test against relaxed limits proves nothing about the real ones.
func DefaultLimits() Limits {
	return Limits{
		Memory:         "128m",
		CPUs:           "0.5",
		Pids:           64,
		TmpfsSize:      "16m",
		MaxOutputBytes: 256 << 10,
		Wall:           10 * time.Second,
	}
}

// sizePattern is Docker's size syntax: a positive integer and a unit.
var sizePattern = regexp.MustCompile(`^[1-9][0-9]*[bkmg]$`)

// Validate checks the limits are ones Docker will accept.
//
// It exists because these can be overridden from the environment, and a
// malformed override is otherwise invisible until the first Solve Run — at
// which point every Judging returns an Error and the service looks broken
// rather than misconfigured. Better to refuse to start.
func (l Limits) Validate() error {
	for name, size := range map[string]string{"memory": l.Memory, "tmpfs size": l.TmpfsSize} {
		if !sizePattern.MatchString(size) {
			return fmt.Errorf("%s limit %q is not a Docker size such as \"128m\"", name, size)
		}
	}
	cpus, err := strconv.ParseFloat(l.CPUs, 64)
	if err != nil || cpus <= 0 {
		return fmt.Errorf("cpu limit %q is not a positive number of cores", l.CPUs)
	}
	switch {
	case l.Pids <= 0:
		return fmt.Errorf("pids limit must be positive, got %d", l.Pids)
	case l.MaxOutputBytes <= 0:
		return fmt.Errorf("output cap must be positive, got %d", l.MaxOutputBytes)
	case l.Wall <= 0:
		return fmt.Errorf("wall-clock cap must be positive, got %s", l.Wall)
	}
	return nil
}

// Execution is what one container did.
type Execution struct {
	// ExitCode is the container's exit status, or -1 if it never reported one.
	ExitCode int
	// Output is the submitted source's own stdout and stderr, capped at
	// MaxOutputBytes.
	Output []byte
	// OutputTruncated reports that the execution wrote past the cap and was
	// killed for it.
	OutputTruncated bool
	// Report is whatever the harness wrote on its private channel.
	Report []byte
	// TimedOut reports that this process, not the container, ended the run
	// because it passed the wall-clock cap.
	TimedOut bool
	// Cancelled reports that the caller gave up before the cap — usually the
	// backend hanging up. Kept apart from TimedOut so a disconnected client
	// does not show up on a dashboard as the judge being slow.
	Cancelled bool
	// MemoryExhausted reports that the kernel's OOM killer ended the run.
	MemoryExhausted bool
	// Duration is wall-clock time from `docker run` to a decision.
	Duration time.Duration
	// Reaped closes once a container this Run abandoned is confirmed gone. It
	// is nil when the container exited on its own, which is the common case.
	//
	// The caller is answering its request either way — that is the whole point
	// of abandoning. This exists so whoever is accounting for how many
	// containers exist can keep counting this one until it really does not.
	Reaped <-chan struct{}
}

// Options configure a Runner.
type Options struct {
	// Limits default to DefaultLimits.
	Limits  Limits
	Logger  *slog.Logger
	Metrics *metrics.Registry
}

// Runner starts sandbox containers and makes sure none of them outlive it.
type Runner struct {
	docker  string
	image   string
	limits  Limits
	label   string
	log     *slog.Logger
	metrics *metrics.Registry

	// live is every container this Runner believes is still serving a request.
	// The sweeper removes labelled containers that are not in it, which is what
	// catches containers orphaned by a crash of this process.
	mu   sync.Mutex
	live map[string]struct{}

	stop     chan struct{}
	stopOnce sync.Once
	sweeping sync.WaitGroup
}

// New builds a Runner and starts its reaper.
func New(opts Options) *Runner {
	if opts.Limits == (Limits{}) {
		opts.Limits = DefaultLimits()
	}
	if opts.Logger == nil {
		opts.Logger = slog.Default()
	}

	r := &Runner{
		docker: dockerCommand,
		image:  DefaultImage,
		limits: opts.Limits,
		// The label carries a per-process instance id, not a constant. Two
		// judges on one host — or, far more often, two tests in one run — must
		// not reap each other's containers out from under a live request.
		label:   "gmc.judge=" + randomHex(8),
		log:     opts.Logger,
		metrics: opts.Metrics,
		live:    map[string]struct{}{},
		stop:    make(chan struct{}),
	}

	r.sweeping.Add(1)
	go r.sweepLoop(sweepInterval)
	return r
}

// Label is the Docker label every container from this Runner carries, in
// `key=value` form. Operators use it to find strays; tests use it to count
// containers independently of the judge's own accounting.
func (r *Runner) Label() string { return r.label }

// Limits reports the caps in force.
func (r *Runner) Limits() Limits { return r.limits }

// Available reports whether a container runtime is actually reachable. The
// judge uses it at startup to decide whether it can judge at all, rather than
// discovering it cannot on the first Solve Run.
func (r *Runner) Available(ctx context.Context) error {
	cmd := exec.CommandContext(ctx, r.docker, "version", "--format", "{{.Server.Version}}")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("no container runtime: %w: %s", err, bytes.TrimSpace(out))
	}
	return nil
}

// Run executes one program and returns what happened. The error is non-nil only
// when the sandbox itself could not be started — a program that crashes, is
// killed or runs away is a successful Run with a telling Execution.
func (r *Runner) Run(ctx context.Context, program []byte) (Execution, error) {
	name := "gmc-judge-" + randomHex(8)

	output := newBoundedWriter(r.limits.MaxOutputBytes)
	report := newBoundedWriter(maxReportBytes)

	cmd := exec.Command(r.docker, r.runArgs(name)...) //nolint:gosec // fixed argv, no shell
	cmd.Stdin = bytes.NewReader(program)
	cmd.Stdout = output
	cmd.Stderr = report

	r.track(name)
	defer r.untrack(name)

	started := time.Now()
	if err := cmd.Start(); err != nil {
		return Execution{}, fmt.Errorf("starting the sandbox: %w", err)
	}

	waited := make(chan error, 1)
	go func() { waited <- cmd.Wait() }()

	deadline := time.NewTimer(r.limits.Wall)
	defer deadline.Stop()

	execution := Execution{ExitCode: -1}
	var abandon string

	select {
	case err := <-waited:
		execution.ExitCode = exitCodeOf(err)

	case <-deadline.C:
		// The supervising process ends the run. Nothing was asked of the
		// container and nothing is waited on: a wedged container is exactly the
		// case this exists for.
		execution.TimedOut = true
		abandon = "wall-clock cap"

	case <-output.exceeded:
		execution.OutputTruncated = true
		abandon = "output cap"

	case <-ctx.Done():
		// The caller gave up — usually the backend hung up. Same treatment for
		// the container, but recorded as its own thing.
		execution.Cancelled = true
		abandon = "caller cancelled"
	}

	if abandon != "" {
		// Kill the local client so the pipe copies finish and this goroutine is
		// not leaked, then hand the container to the reaper. Neither is waited
		// on, so answering the request never depends on how cooperative the
		// container feels.
		_ = cmd.Process.Kill()
		go func() { <-waited }()

		reaped := make(chan struct{})
		go func() {
			defer close(reaped)
			r.reap(name, abandon)
		}()
		execution.Reaped = reaped
	}

	execution.Duration = time.Since(started)
	execution.Output, execution.OutputTruncated = output.collected()
	execution.Report, _ = report.collected()

	if execution.OutputTruncated && r.metrics != nil {
		r.metrics.OutputTruncated()
	}

	// 137 is SIGKILL. On a run this process did not kill, and did not overrun
	// the output cap, the only thing left holding the knife is the kernel's OOM
	// killer acting on the memory cgroup. The container is already gone by then
	// (--rm), so there is no inspect to consult; the exit code is the evidence.
	execution.MemoryExhausted = execution.ExitCode == 137 && abandon == ""

	return execution, nil
}

func (r *Runner) runArgs(name string) []string {
	memory := r.limits.Memory
	return []string{
		"run",
		"--rm",
		"--name", name,
		"--label", r.label,

		// No network at all: no interfaces beyond loopback, no DNS, no route.
		// Not a firewall rule that could be misconfigured — no stack to
		// configure (ADR-0005).
		"--network=none",

		// Swap pinned to the memory cap, which disables it.
		"--memory=" + memory,
		"--memory-swap=" + memory,
		"--cpus=" + r.limits.CPUs,
		"--pids-limit=" + strconv.Itoa(r.limits.Pids),

		// Nothing on the root filesystem is writable, and the one writable path
		// is a size-limited tmpfs that cannot execute what is written to it.
		"--read-only",
		"--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=" + r.limits.TmpfsSize,

		// Drop every capability and forbid regaining any. Together these mean a
		// setuid binary inside the image buys the program nothing.
		"--cap-drop=ALL",
		"--security-opt=no-new-privileges:true",
		"--user", nobodyUser,

		// No log driver: the daemon must not write this container's output to
		// the host's disk. The supervisor collects what it needs from the
		// attached pipes, under a cap.
		"--log-driver=none",

		"--workdir", "/tmp",
		"--env", "HOME=/tmp",
		"--env", "PYTHONDONTWRITEBYTECODE=1",

		// The program arrives on stdin, so nothing is ever written to a file
		// and the read-only root filesystem costs us nothing.
		"--interactive",
		"--entrypoint", "python3",
		r.image,
		// -I isolates the interpreter from the environment and any user site
		// directory; -u keeps output unbuffered, so the output cap trips while
		// the program is running rather than after it exits.
		"-I", "-u", "-",
	}
}

func (r *Runner) track(name string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.live[name] = struct{}{}
}

func (r *Runner) untrack(name string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.live, name)
}

// reap force-removes a container that outlived its request.
func (r *Runner) reap(name, why string) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	out, err := exec.CommandContext(ctx, r.docker, "rm", "--force", "--volumes", name).CombinedOutput()
	if err != nil {
		// A container that finished on its own between the decision and this
		// call is already gone, and --rm removed it. That is a success.
		if strings.Contains(string(out), "No such container") {
			return
		}
		r.log.Warn("could not reap a sandbox container",
			slog.String("container", name), slog.String("reason", why), slog.Any("error", err))
		return
	}
	r.log.Info("reaped a sandbox container",
		slog.String("container", name), slog.String("reason", why))
	if r.metrics != nil {
		r.metrics.ContainersReaped(1)
	}
}

// sweepLoop catches what reap cannot: containers this Runner started and then
// lost track of, including ones orphaned by a crash of a previous process.
func (r *Runner) sweepLoop(interval time.Duration) {
	defer r.sweeping.Done()
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-r.stop:
			return
		case <-ticker.C:
			r.sweep()
		}
	}
}

func (r *Runner) sweep() {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	out, err := exec.CommandContext(ctx, r.docker,
		"ps", "--all", "--filter", "label="+r.label, "--format", "{{.Names}}").Output()
	if err != nil {
		r.log.Warn("could not list sandbox containers", slog.Any("error", err))
		return
	}

	r.mu.Lock()
	live := make(map[string]struct{}, len(r.live))
	for name := range r.live {
		live[name] = struct{}{}
	}
	r.mu.Unlock()

	for _, name := range strings.Fields(string(out)) {
		if _, serving := live[name]; serving {
			continue
		}
		r.reap(name, "abandoned")
	}
}

// Close stops the reaper and sweeps once more, so shutting the judge down does
// not leave containers behind.
func (r *Runner) Close() error {
	r.stopOnce.Do(func() { close(r.stop) })
	r.sweeping.Wait()
	r.sweep()
	return nil
}

func exitCodeOf(err error) int {
	if err == nil {
		return 0
	}
	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) {
		return exitErr.ExitCode()
	}
	return -1
}

func randomHex(n int) string {
	buf := make([]byte, n)
	// crypto/rand.Read never returns an error on any supported platform; it
	// panics internally if the OS source fails, which is the right outcome for
	// a process whose isolation depends on unguessable container names.
	_, _ = rand.Read(buf)
	return hex.EncodeToString(buf)
}
