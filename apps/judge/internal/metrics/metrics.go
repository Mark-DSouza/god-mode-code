// Package metrics is the judge's only way of telling anyone how it is doing.
//
// The judge has no egress, so it cannot push telemetry to an observability sink
// and cannot even resolve one's name (ADR-0005). What it can do is expose a
// scrape endpoint on the private link the backend already uses, and write
// structured JSON to stdout for whoever is on the box. This package is the
// first half of that; slog is the second.
//
// The exposition format is Prometheus text 0.0.4, hand-written. Pulling in a
// client library to emit six counters would add the judge's first third-party
// dependency to a binary whose job is to be small and auditable.
package metrics

import (
	"fmt"
	"io"
	"sort"
	"strings"
	"sync"
	"time"
)

// ContentType is the media type a Prometheus scraper expects.
const ContentType = "text/plain; version=0.0.4; charset=utf-8"

// Registry holds the judge's counters. Every method is safe for concurrent use;
// the worker pool calls them from several goroutines at once.
type Registry struct {
	version string

	mu              sync.Mutex
	verdicts        map[string]int64
	workers         int64
	inFlight        int64
	queued          int64
	durationSeconds float64
	durationCount   int64
	outputTruncated int64
	reaped          int64
	rejected        int64
}

// NewRegistry builds a registry that reports the given build version.
func NewRegistry(version string) *Registry {
	return &Registry{
		version:  version,
		verdicts: map[string]int64{},
	}
}

// SetWorkers records the pool bound, so a scrape shows how close to saturation
// the judge is running rather than an in-flight count with no denominator.
func (r *Registry) SetWorkers(n int) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.workers = int64(n)
}

// QueueEnter and QueueLeave bracket the wait for a worker slot.
func (r *Registry) QueueEnter() { r.add(&r.queued, 1) }

// QueueLeave is the counterpart to QueueEnter.
func (r *Registry) QueueLeave() { r.add(&r.queued, -1) }

// ExecutionStart and ExecutionEnd bracket a container actually running.
func (r *Registry) ExecutionStart() { r.add(&r.inFlight, 1) }

// ExecutionEnd is the counterpart to ExecutionStart.
func (r *Registry) ExecutionEnd() { r.add(&r.inFlight, -1) }

// ObserveJudging records a completed Judging and its Verdict.
func (r *Registry) ObserveJudging(verdict string, took time.Duration) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.verdicts[verdict]++
	r.durationSeconds += took.Seconds()
	r.durationCount++
}

// OutputTruncated records that a submitted source ran past the output cap.
func (r *Registry) OutputTruncated() { r.add(&r.outputTruncated, 1) }

// ContainersReaped records containers removed after outliving their request.
func (r *Registry) ContainersReaped(n int) { r.add(&r.reaped, int64(n)) }

// Rejected records a request refused before it reached a worker.
func (r *Registry) Rejected() { r.add(&r.rejected, 1) }

func (r *Registry) add(target *int64, delta int64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	*target += delta
}

// WriteTo renders the registry in Prometheus text exposition format.
func (r *Registry) WriteTo(w io.Writer) (int64, error) {
	r.mu.Lock()
	// Snapshot under the lock, render outside it: rendering writes to a socket,
	// and holding a mutex across a network write blocks every judging behind
	// the slowest scraper.
	verdicts := make(map[string]int64, len(r.verdicts))
	for verdict, count := range r.verdicts {
		verdicts[verdict] = count
	}
	snapshot := struct {
		workers, inFlight, queued, durationCount int64
		outputTruncated, reaped, rejected        int64
		durationSeconds                          float64
	}{r.workers, r.inFlight, r.queued, r.durationCount,
		r.outputTruncated, r.reaped, r.rejected, r.durationSeconds}
	version := r.version
	r.mu.Unlock()

	// Every Verdict is named even at zero. A counter that appears only once it
	// is non-zero makes "no timeouts" and "not scraping" look identical.
	for _, verdict := range []string{"passed", "failed", "timeout", "error"} {
		if _, ok := verdicts[verdict]; !ok {
			verdicts[verdict] = 0
		}
	}
	names := make([]string, 0, len(verdicts))
	for verdict := range verdicts {
		names = append(names, verdict)
	}
	sort.Strings(names)

	var out strings.Builder
	out.WriteString("# HELP judge_judgings_total Judgings completed, by Verdict.\n")
	out.WriteString("# TYPE judge_judgings_total counter\n")
	for _, verdict := range names {
		fmt.Fprintf(&out, "judge_judgings_total{verdict=%q} %d\n", verdict, verdicts[verdict])
	}

	out.WriteString("# HELP judge_judgings_rejected_total Requests refused before reaching a worker.\n")
	out.WriteString("# TYPE judge_judgings_rejected_total counter\n")
	fmt.Fprintf(&out, "judge_judgings_rejected_total %d\n", snapshot.rejected)

	out.WriteString("# HELP judge_executions_in_flight Sandbox containers running right now.\n")
	out.WriteString("# TYPE judge_executions_in_flight gauge\n")
	fmt.Fprintf(&out, "judge_executions_in_flight %d\n", snapshot.inFlight)

	out.WriteString("# HELP judge_workers Worker pool bound: the most containers that can run at once.\n")
	out.WriteString("# TYPE judge_workers gauge\n")
	fmt.Fprintf(&out, "judge_workers %d\n", snapshot.workers)

	out.WriteString("# HELP judge_queue_waiting Requests waiting for a worker slot.\n")
	out.WriteString("# TYPE judge_queue_waiting gauge\n")
	fmt.Fprintf(&out, "judge_queue_waiting %d\n", snapshot.queued)

	out.WriteString("# HELP judge_judging_duration_seconds Wall-clock time spent judging.\n")
	out.WriteString("# TYPE judge_judging_duration_seconds summary\n")
	fmt.Fprintf(&out, "judge_judging_duration_seconds_sum %g\n", snapshot.durationSeconds)
	fmt.Fprintf(&out, "judge_judging_duration_seconds_count %d\n", snapshot.durationCount)

	out.WriteString("# HELP judge_output_truncated_total Executions whose output ran past the cap.\n")
	out.WriteString("# TYPE judge_output_truncated_total counter\n")
	fmt.Fprintf(&out, "judge_output_truncated_total %d\n", snapshot.outputTruncated)

	out.WriteString("# HELP judge_containers_reaped_total Containers force-removed after outliving their request.\n")
	out.WriteString("# TYPE judge_containers_reaped_total counter\n")
	fmt.Fprintf(&out, "judge_containers_reaped_total %d\n", snapshot.reaped)

	out.WriteString("# HELP judge_build_info The running build, always 1.\n")
	out.WriteString("# TYPE judge_build_info gauge\n")
	fmt.Fprintf(&out, "judge_build_info{version=%q} 1\n", version)

	n, err := io.WriteString(w, out.String())
	return int64(n), err
}
