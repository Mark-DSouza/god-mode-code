package api_test

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Mark-DSouza/god-mode-code/apps/judge/internal/api"
)

// The judge test seam: requests go over a real socket to a real server, the
// same way the backend will call it. Nothing here calls a handler function
// directly — routing, method matching, status codes and JSON encoding are all
// part of what the backend depends on, and calling handlers directly tests none
// of them.
func startJudge(t *testing.T, opts ...api.Option) *httptest.Server {
	t.Helper()
	opts = append([]api.Option{
		// Discard logs so a failing test's output is the failure, not a request log.
		api.WithLogger(slog.New(slog.NewTextHandler(io.Discard, nil))),
	}, opts...)
	server := httptest.NewServer(api.New("test", opts...).Handler())
	t.Cleanup(server.Close)
	return server
}

func TestHealthReportsUp(t *testing.T) {
	t.Parallel()
	server := startJudge(t)

	response, err := http.Get(server.URL + "/health")
	if err != nil {
		t.Fatalf("GET /health: %v", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		t.Errorf("status = %d, want %d", response.StatusCode, http.StatusOK)
	}
	if got := response.Header.Get("Content-Type"); got != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", got)
	}

	var health api.Health
	if err := json.NewDecoder(response.Body).Decode(&health); err != nil {
		t.Fatalf("decoding body: %v", err)
	}
	if health.Status != api.StatusUp {
		t.Errorf("status = %q, want %q", health.Status, api.StatusUp)
	}
	if health.Version != "test" {
		t.Errorf("version = %q, want %q", health.Version, "test")
	}
}

func TestHealthReportsUptime(t *testing.T) {
	t.Parallel()

	// A controlled clock: the server starts at the first tick and the request
	// lands 90 seconds later.
	current := time.Unix(1_700_000_000, 0)
	server := startJudge(t, api.WithClock(func() time.Time { return current }))
	current = current.Add(90 * time.Second)

	response, err := http.Get(server.URL + "/health")
	if err != nil {
		t.Fatalf("GET /health: %v", err)
	}
	defer response.Body.Close()

	var health api.Health
	if err := json.NewDecoder(response.Body).Decode(&health); err != nil {
		t.Fatalf("decoding body: %v", err)
	}
	if health.UptimeSeconds != 90 {
		t.Errorf("uptimeSeconds = %d, want 90", health.UptimeSeconds)
	}
}

func TestHealthRejectsNonGet(t *testing.T) {
	t.Parallel()
	server := startJudge(t)

	response, err := http.Post(server.URL+"/health", "application/json", nil)
	if err != nil {
		t.Fatalf("POST /health: %v", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusMethodNotAllowed {
		t.Errorf("status = %d, want %d", response.StatusCode, http.StatusMethodNotAllowed)
	}
}

func TestUnknownRouteIsNotFound(t *testing.T) {
	t.Parallel()
	server := startJudge(t)

	response, err := http.Get(server.URL + "/nope")
	if err != nil {
		t.Fatalf("GET /nope: %v", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusNotFound {
		t.Errorf("status = %d, want %d", response.StatusCode, http.StatusNotFound)
	}
}
