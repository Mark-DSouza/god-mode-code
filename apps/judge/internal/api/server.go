// Package api is the judge's HTTP boundary.
//
// The judge exists to execute untrusted code inside containers that cannot hurt
// anything. None of that is implemented yet — the sandboxing, the worker pool
// and the resource limits arrive with the judge's own ticket. What is here is
// the boundary those will be tested through, and proof that the service builds,
// serves and shuts down cleanly.
package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"
)

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
}

// Server holds the judge's HTTP surface and the state its handlers report on.
type Server struct {
	version   string
	startedAt time.Time
	now       func() time.Time
	log       *slog.Logger
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
	return s.withRequestLogging(mux)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	s.writeJSON(w, r, http.StatusOK, Health{
		Status:        StatusUp,
		Version:       s.version,
		UptimeSeconds: int64(s.now().Sub(s.startedAt).Seconds()),
	})
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
