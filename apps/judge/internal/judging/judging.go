// Package judging executes submitted source against a Pattern's tests and
// turns what happened into a Verdict.
//
// It sits between the HTTP boundary and the sandbox, and owns two things the
// sandbox cannot: the Pattern catalogue, and the worker pool that bounds how
// many containers exist at once. The bound is not politeness — the judge runs
// on a 1GB instance (ADR-0005), and an unbounded handler would let a burst of
// Solve Runs start more containers than the host has memory for, at which point
// the kernel starts choosing which ones to kill.
package judging

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/Mark-DSouza/god-mode-code/apps/judge/internal/metrics"
	"github.com/Mark-DSouza/god-mode-code/apps/judge/internal/pattern"
	"github.com/Mark-DSouza/god-mode-code/apps/judge/internal/sandbox"
)

// Verdict is the outcome of a Solve Run (CONTEXT.md). Only Passed is ranked.
type Verdict string

const (
	// VerdictPassed means every test the Pattern defines was satisfied.
	VerdictPassed Verdict = "passed"
	// VerdictFailed means the source ran and at least one test was not.
	VerdictFailed Verdict = "failed"
	// VerdictTimeout means the supervising process ended the execution.
	VerdictTimeout Verdict = "timeout"
	// VerdictError means the source never got as far as being wrong: it did not
	// compile, it died on a limit, or the sandbox could not report.
	VerdictError Verdict = "error"
)

// Request is one Solve Run's submitted source and the Pattern it answers.
type Request struct {
	PatternID string `json:"patternId"`
	Source    string `json:"source"`
}

// Judging is the record of executing submitted source against a Pattern's
// tests: the Verdict, and enough of what produced it to be worth showing.
type Judging struct {
	PatternID string  `json:"patternId"`
	Verdict   Verdict `json:"verdict"`
	// TestsPassed and TestsTotal count Example Tests and Hidden Tests together.
	// They are populated even when nothing ran, so a player always sees the
	// size of what they were judged against.
	TestsPassed    int   `json:"testsPassed"`
	TestsTotal     int   `json:"testsTotal"`
	DurationMillis int64 `json:"durationMillis"`
	// Detail describes an Example Test's failure or an execution fault. A
	// Hidden Test's failure never appears here — it is reported only as a count
	// (CONTEXT.md).
	Detail string `json:"detail,omitempty"`
}

// ErrUnknownPattern is returned when the catalogue has no such Pattern.
var ErrUnknownPattern = errors.New("unknown Pattern")

// ErrBusy is returned when every worker is taken and the queue wait ran out.
var ErrBusy = errors.New("no judging capacity")

// reapGrace bounds how long a worker slot is held open for a container that is
// being killed. `docker rm --force` is a SIGKILL and takes milliseconds; if it
// has not returned in this long the daemon itself is in trouble, and holding
// the pool closed waiting for it would turn one stuck container into an outage.
const reapGrace = 30 * time.Second

// Sandbox is the container runtime seam. It is an interface so this package can
// be reasoned about without Docker — but note that the judge's own tests
// deliberately do not use that freedom. A stubbed runtime would prove only that
// the flags are spelled correctly, and the flags holding is the entire product.
type Sandbox interface {
	Run(ctx context.Context, program []byte) (sandbox.Execution, error)
	Limits() sandbox.Limits
}

// Options configure a Judge.
type Options struct {
	Sandbox  Sandbox
	Patterns *pattern.Catalogue
	// Workers bounds concurrent executions. Defaults to 2, which is what fits
	// alongside the supervisor in 1GB.
	Workers int
	// QueueWait is how long a request will wait for a worker before being
	// refused. Refusing beats queueing forever: the backend has its own
	// deadline, and a request nobody is waiting for is a container nobody
	// wanted.
	QueueWait time.Duration
	Metrics   *metrics.Registry
	Logger    *slog.Logger
}

// Judge performs Judging.
type Judge struct {
	sandbox   Sandbox
	patterns  *pattern.Catalogue
	queueWait time.Duration
	metrics   *metrics.Registry
	log       *slog.Logger

	// workers is a counting semaphore. A slot is a permit to have one container
	// running; there are no long-lived goroutines to keep warm, because the
	// expensive thing is the container, not the goroutine.
	workers chan struct{}
}

// New builds a Judge.
func New(opts Options) *Judge {
	if opts.Workers <= 0 {
		opts.Workers = 2
	}
	if opts.QueueWait <= 0 {
		opts.QueueWait = 30 * time.Second
	}
	if opts.Logger == nil {
		opts.Logger = slog.Default()
	}
	if opts.Metrics != nil {
		opts.Metrics.SetWorkers(opts.Workers)
	}
	return &Judge{
		sandbox:   opts.Sandbox,
		patterns:  opts.Patterns,
		queueWait: opts.QueueWait,
		metrics:   opts.Metrics,
		log:       opts.Logger,
		workers:   make(chan struct{}, opts.Workers),
	}
}

// Judge executes submitted source and returns a Verdict.
//
// The error is reserved for requests that never became a Judging — an unknown
// Pattern, or no capacity. Submitted source that times out, exhausts memory or
// never compiles is a perfectly good Judging with a telling Verdict.
func (j *Judge) Judge(ctx context.Context, request Request) (Judging, error) {
	p, known := j.patterns.Lookup(request.PatternID)
	if !known {
		return Judging{}, fmt.Errorf("%w: %q", ErrUnknownPattern, request.PatternID)
	}

	total := len(p.ExampleTests) + len(p.HiddenTests)
	started := time.Now()

	release, err := j.acquire(ctx)
	if err != nil {
		if j.metrics != nil {
			j.metrics.Rejected()
		}
		return Judging{}, err
	}
	handedOff := false
	defer func() {
		if !handedOff {
			release()
		}
	}()

	judged, reaped := j.execute(ctx, p, request.Source, total)
	if reaped != nil {
		// The container outlived its request and is being killed. The request
		// is answered now — that is the point of abandoning it — but the worker
		// slot stays taken until the container is really gone, because until
		// then it is still holding its share of a 1GB host (ADR-0005). Freeing
		// the slot on the reply would let a burst of wedged Solve Runs put more
		// containers on the box than the pool is supposed to allow.
		handedOff = true
		go func() {
			defer release()
			select {
			case <-reaped:
			case <-time.After(reapGrace):
				j.log.Error("a sandbox container outlived its reap grace; freeing its worker anyway",
					slog.Duration("grace", reapGrace))
			}
		}()
	}
	judged.PatternID = p.ID
	// Measured from the request, not from `docker run`: queueing is time the
	// player waited, and a duration that hides it is a duration that lies.
	judged.DurationMillis = time.Since(started).Milliseconds()

	if j.metrics != nil {
		j.metrics.ObserveJudging(string(judged.Verdict), time.Since(started))
	}
	// The judge's only durable record of itself. No egress means no route to an
	// observability sink, so this line on stdout — kept locally by the service
	// manager — is what an operator on the box has to work with (ADR-0005).
	j.log.InfoContext(ctx, "judged",
		slog.String("patternId", judged.PatternID),
		slog.String("verdict", string(judged.Verdict)),
		slog.Int("testsPassed", judged.TestsPassed),
		slog.Int("testsTotal", judged.TestsTotal),
		slog.Int64("durationMillis", judged.DurationMillis),
		slog.Int("sourceBytes", len(request.Source)),
	)
	return judged, nil
}

// acquire takes a worker slot, or gives up.
func (j *Judge) acquire(ctx context.Context) (func(), error) {
	if j.metrics != nil {
		j.metrics.QueueEnter()
		defer j.metrics.QueueLeave()
	}

	waited := time.NewTimer(j.queueWait)
	defer waited.Stop()

	select {
	case j.workers <- struct{}{}:
		if j.metrics != nil {
			j.metrics.ExecutionStart()
		}
		return func() {
			<-j.workers
			if j.metrics != nil {
				j.metrics.ExecutionEnd()
			}
		}, nil
	case <-waited.C:
		return nil, ErrBusy
	case <-ctx.Done():
		return nil, fmt.Errorf("waiting for judging capacity: %w", ctx.Err())
	}
}

// execute runs one Solve Run. The second return is the sandbox's reap signal,
// non-nil only when a container had to be abandoned; see Judge.
func (j *Judge) execute(ctx context.Context, p pattern.Pattern, source string, total int) (Judging, <-chan struct{}) {
	// Fresh per execution, so nothing carries from one Solve Run to the next.
	nonce := "\x1egmc-judge-" + randomHex(12) + ":"

	program, err := buildHarness(p, source, nonce)
	if err != nil {
		j.log.ErrorContext(ctx, "could not build the harness", slog.Any("error", err))
		return Judging{Verdict: VerdictError, TestsTotal: total, Detail: "the judge could not prepare this Pattern"}, nil
	}

	execution, err := j.sandbox.Run(ctx, program)
	if err != nil {
		j.log.ErrorContext(ctx, "the sandbox would not start", slog.Any("error", err))
		return Judging{Verdict: VerdictError, TestsTotal: total, Detail: "the judge could not start a sandbox"}, nil
	}

	return j.verdictOf(ctx, execution, nonce, total), execution.Reaped
}

// verdictOf reads an Execution as a Verdict.
//
// Order matters. The ways an execution can be stopped are checked before the
// harness's own report, because a stopped execution may have reported nothing —
// or, worse, reported a partial run that would read as a Failed Verdict when
// the truth is that it was killed.
func (j *Judge) verdictOf(ctx context.Context, execution sandbox.Execution, nonce string, total int) Judging {
	limits := j.sandbox.Limits()

	switch {
	case execution.TimedOut:
		return Judging{
			Verdict:    VerdictTimeout,
			TestsTotal: total,
			Detail:     fmt.Sprintf("execution did not finish within %s", limits.Wall),
		}

	case execution.Cancelled:
		// Nobody is waiting for this — the caller hung up. It is an Error
		// rather than a Timeout so it cannot be read as the judge being slow.
		return Judging{
			Verdict:    VerdictError,
			TestsTotal: total,
			Detail:     "the request was cancelled before judging finished",
		}

	case execution.OutputTruncated:
		return Judging{
			Verdict:    VerdictError,
			TestsTotal: total,
			Detail:     fmt.Sprintf("execution wrote more than %d bytes of output and was stopped", limits.MaxOutputBytes),
		}

	case execution.MemoryExhausted:
		return Judging{
			Verdict:    VerdictError,
			TestsTotal: total,
			Detail:     fmt.Sprintf("execution exceeded the %s memory cap", limits.Memory),
		}
	}

	reported, found := findReport(execution.Report, nonce)
	if !found {
		// The container ran and stopped without a report: killed by a limit we
		// did not name, or the source called os._exit. Say what is true.
		j.log.WarnContext(ctx, "no report from the sandbox",
			slog.Int("exitCode", execution.ExitCode),
			slog.String("stderr", tail(string(execution.Report), 400)))
		return Judging{
			Verdict:    VerdictError,
			TestsTotal: total,
			Detail:     fmt.Sprintf("execution ended without a result (exit code %d)", execution.ExitCode),
		}
	}

	judged := Judging{
		TestsPassed: reported.Passed,
		TestsTotal:  reported.Total,
		Detail:      reported.Detail,
	}
	switch reported.Outcome {
	case "passed":
		judged.Verdict = VerdictPassed
	case "failed":
		judged.Verdict = VerdictFailed
	default:
		// The harness reports "error" when the submitted source did not run at
		// all — a syntax error, or an exception at the top level.
		judged.Verdict = VerdictError
	}
	return judged
}

func tail(text string, limit int) string {
	text = strings.TrimSpace(text)
	if len(text) <= limit {
		return text
	}
	return "..." + text[len(text)-limit:]
}

func randomHex(n int) string {
	buf := make([]byte, n)
	_, _ = rand.Read(buf)
	return hex.EncodeToString(buf)
}
