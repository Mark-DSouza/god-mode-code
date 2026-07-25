// Package api is the judge's HTTP boundary.
//
// Three routes, and each is somebody's contract: the backend posts a Solve
// Run's submitted source to /judgings and gets a Verdict, scrapes /metrics
// because the judge has no way to ship telemetry itself (ADR-0005), and reads
// /health to know whether the judge can judge at all.
//
// That last one is not a formality. The judge needs a container runtime, and it
// is perfectly capable of serving without one — in the containerised local
// stack it has no runtime by design. It says so, in DEGRADED, rather than
// accepting Solve Runs it will fail.
package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/Mark-DSouza/god-mode-code/apps/judge/internal/judging"
	"github.com/Mark-DSouza/god-mode-code/apps/judge/internal/metrics"
)

// maxSourceBytes caps a submitted source. A Pattern's editable region is four
// to eight lines (ADR-0004), so this is three orders of magnitude of slack —
// large enough never to reject an honest Solve Run, small enough that a request
// body cannot be the attack.
const maxSourceBytes = 64 << 10

// Status mirrors the backend's vocabulary so operators reading two health
// endpoints do not have to hold two sets of words in their head.
type Status string

const (
	StatusUp       Status = "UP"
	StatusDegraded Status = "DEGRADED"
)

// Health is what the judge reports about itself.
type Health struct {
	Status  Status `json:"status"`
	Version string `json:"version"`
	// Uptime in seconds. The backend scrapes the judge across the private link
	// because the judge has no egress of its own and cannot ship telemetry
	// anywhere (ADR-0005, ADR-0008); a restart is otherwise invisible.
	UptimeSeconds int64 `json:"uptimeSeconds"`
	// Judging reports whether Solve Runs can actually be judged. False means
	// there is no container runtime, which is DEGRADED rather than down: the
	// service is answering, it just cannot do the one thing it is for.
	Judging bool `json:"judging"`
}

// Problem is the shape of every error response, so the backend has one thing to
// parse rather than a different body per status code.
type Problem struct {
	Error string `json:"error"`
}

// Server holds the judge's HTTP surface and the state its handlers report on.
type Server struct {
	version   string
	startedAt time.Time
	now       func() time.Time
	log       *slog.Logger
	judge     *judging.Judge
	metrics   *metrics.Registry
}

// Option configures a Server.
type Option func(*Server)

// WithClock replaces the time source. Tests use it to make uptime deterministic
// rather than asserting on "some number that is probably small".
func WithClock(now func() time.Time) Option {
	return func(s *Server) {
		s.now = now
		s.startedAt = now()
	}
}

// WithLogger replaces the logger.
func WithLogger(log *slog.Logger) Option {
	return func(s *Server) { s.log = log }
}

// WithJudge attaches the thing that actually judges. Without it the service
// serves, reports DEGRADED, and refuses Solve Runs.
func WithJudge(j *judging.Judge) Option {
	return func(s *Server) { s.judge = j }
}

// WithMetrics attaches the registry served at /metrics.
func WithMetrics(registry *metrics.Registry) Option {
	return func(s *Server) { s.metrics = registry }
}

// New builds a Server.
func New(version string, opts ...Option) *Server {
	s := &Server{
		version:   version,
		startedAt: time.Now(),
		now:       time.Now,
		log:       slog.Default(),
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// Handler returns the judge's routes.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	// Method-qualified patterns, so a POST to the health endpoint gets a 405
	// rather than being quietly treated as a GET.
	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("GET /metrics", s.handleMetrics)
	mux.HandleFunc("POST /judgings", s.handleJudging)
	return s.withRequestLogging(mux)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	status := StatusUp
	if s.judge == nil {
		status = StatusDegraded
	}
	s.writeJSON(w, r, http.StatusOK, Health{
		Status:        status,
		Version:       s.version,
		UptimeSeconds: int64(s.now().Sub(s.startedAt).Seconds()),
		Judging:       s.judge != nil,
	})
}

func (s *Server) handleMetrics(w http.ResponseWriter, r *http.Request) {
	if s.metrics == nil {
		http.Error(w, "no metrics registry", http.StatusServiceUnavailable)
		return
	}
	w.Header().Set("Content-Type", metrics.ContentType)
	if _, err := s.metrics.WriteTo(w); err != nil {
		s.log.ErrorContext(r.Context(), "could not write metrics", slog.Any("error", err))
	}
}

// handleJudging turns one Solve Run's submitted source into a Verdict.
//
// Note what is a 200: timeout, memory exhaustion and source that does not
// compile all come back as 200 with a Verdict, because the judge did its job.
// Only a request the judge never judged — unknown Pattern, no capacity, no
// runtime — gets a status code of its own.
func (s *Server) handleJudging(w http.ResponseWriter, r *http.Request) {
	// The body is capped before it is read, not after: reading an unbounded
	// body into memory to discover it was too large is the bug this prevents.
	var request judging.Request
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxSourceBytes+4<<10))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&request); err != nil {
		s.writeJSON(w, r, http.StatusBadRequest, Problem{Error: "could not read the request: " + err.Error()})
		return
	}

	// Validated before the runtime is consulted, so a malformed request gets
	// the same answer whether or not this judge happens to be able to judge.
	switch {
	case request.PatternID == "":
		s.writeJSON(w, r, http.StatusBadRequest, Problem{Error: "patternId is required"})
		return
	case request.Source == "":
		s.writeJSON(w, r, http.StatusBadRequest, Problem{Error: "source is required"})
		return
	case len(request.Source) > maxSourceBytes:
		s.writeJSON(w, r, http.StatusRequestEntityTooLarge,
			Problem{Error: "source is larger than this judge accepts"})
		return
	}

	if s.judge == nil {
		s.writeJSON(w, r, http.StatusServiceUnavailable,
			Problem{Error: "this judge has no container runtime and cannot judge Solve Runs"})
		return
	}

	judged, err := s.judge.Judge(r.Context(), request)
	switch {
	case errors.Is(err, judging.ErrUnknownPattern):
		s.writeJSON(w, r, http.StatusNotFound, Problem{Error: "no such Pattern"})
	case errors.Is(err, judging.ErrBusy):
		// 503 with Retry-After, not 500: the backend should come back, and this
		// is the judge's only way to say so.
		w.Header().Set("Retry-After", "1")
		s.writeJSON(w, r, http.StatusServiceUnavailable, Problem{Error: "the judge is at capacity"})
	case err != nil:
		s.log.ErrorContext(r.Context(), "judging failed", slog.Any("error", err))
		s.writeJSON(w, r, http.StatusInternalServerError, Problem{Error: "judging failed"})
	default:
		s.writeJSON(w, r, http.StatusOK, judged)
	}
}

func (s *Server) writeJSON(w http.ResponseWriter, r *http.Request, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		// The status line is already on the wire, so there is no way to turn
		// this into an error response. Logging it is all that is left.
		s.log.ErrorContext(r.Context(), "could not write response body",
			slog.String("path", r.URL.Path), slog.Any("error", err))
	}
}

func (s *Server) withRequestLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := s.now()
		recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(recorder, r)
		s.log.InfoContext(r.Context(), "request",
			slog.String("method", r.Method),
			slog.String("path", r.URL.Path),
			slog.Int("status", recorder.status),
			slog.Duration("duration", s.now().Sub(start)),
		)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}
