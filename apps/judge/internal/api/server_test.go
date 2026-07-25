package api_test

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Mark-DSouza/god-mode-code/apps/judge/internal/api"
	"github.com/Mark-DSouza/god-mode-code/apps/judge/internal/metrics"
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

// The status a judge reports depends on whether it can actually judge, so it is
// asserted in the two tests that set that up. This one is about the envelope:
// status code, media type, version.
func TestHealthReportsTheBuild(t *testing.T) {
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

// A judge with no container runtime attached — the shape it takes in the
// containerised local stack, where mounting a container socket would be the
// most direct escape path there is (ADR-0005).
func TestHealthReportsDegradedWithoutAContainerRuntime(t *testing.T) {
	t.Parallel()
	server := startJudge(t)

	response, err := http.Get(server.URL + "/health")
	if err != nil {
		t.Fatalf("GET /health: %v", err)
	}
	defer response.Body.Close()

	var health api.Health
	if err := json.NewDecoder(response.Body).Decode(&health); err != nil {
		t.Fatalf("decoding body: %v", err)
	}
	if health.Status != api.StatusDegraded {
		t.Errorf("status = %q, want %q", health.Status, api.StatusDegraded)
	}
	if health.Judging {
		t.Error("judging = true, want false without a container runtime")
	}
}

func TestJudgingIsRefusedWithoutAContainerRuntime(t *testing.T) {
	t.Parallel()
	server := startJudge(t)

	response := postJudging(t, server.URL, `{"patternId":"hash-map-seen-lookup","source":"x = 1"}`)
	defer response.Body.Close()

	if response.StatusCode != http.StatusServiceUnavailable {
		t.Errorf("status = %d, want %d", response.StatusCode, http.StatusServiceUnavailable)
	}
}

func TestJudgingRejectsMalformedRequests(t *testing.T) {
	t.Parallel()
	server := startJudge(t)

	cases := map[string]struct {
		body string
		want int
	}{
		"not JSON at all":  {`{`, http.StatusBadRequest},
		"no patternId":     {`{"source":"x = 1"}`, http.StatusBadRequest},
		"no source":        {`{"patternId":"hash-map-seen-lookup"}`, http.StatusBadRequest},
		"unknown field":    {`{"patternId":"p","source":"x = 1","language":"go"}`, http.StatusBadRequest},
		"source too large": {`{"patternId":"p","source":"` + strings.Repeat("x", 65<<10) + `"}`, http.StatusRequestEntityTooLarge},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			response := postJudging(t, server.URL, tc.body)
			defer response.Body.Close()
			if response.StatusCode != tc.want {
				t.Errorf("status = %d, want %d", response.StatusCode, tc.want)
			}
		})
	}
}

// The backend's only window into a service that cannot ship telemetry anywhere
// (ADR-0005), so its format is a contract.
func TestMetricsAreExposedInPrometheusFormat(t *testing.T) {
	t.Parallel()
	registry := metrics.NewRegistry("test")
	server := startJudge(t, api.WithMetrics(registry))

	response, err := http.Get(server.URL + "/metrics")
	if err != nil {
		t.Fatalf("GET /metrics: %v", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.StatusCode, http.StatusOK)
	}
	if got := response.Header.Get("Content-Type"); got != metrics.ContentType {
		t.Errorf("Content-Type = %q, want %q", got, metrics.ContentType)
	}

	body, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatalf("reading body: %v", err)
	}
	// Every Verdict is named even at zero, so "no timeouts" and "not scraping"
	// cannot look the same on a dashboard.
	for _, want := range []string{
		`judge_judgings_total{verdict="passed"} 0`,
		`judge_judgings_total{verdict="failed"} 0`,
		`judge_judgings_total{verdict="timeout"} 0`,
		`judge_judgings_total{verdict="error"} 0`,
		"judge_executions_in_flight 0",
		"judge_workers 0",
		`judge_build_info{version="test"} 1`,
	} {
		if !strings.Contains(string(body), want) {
			t.Errorf("/metrics is missing %q:\n%s", want, body)
		}
	}
}

func postJudging(t *testing.T, base, body string) *http.Response {
	t.Helper()
	response, err := http.Post(base+"/judgings", "application/json", strings.NewReader(body))
	if err != nil {
		t.Fatalf("POST /judgings: %v", err)
	}
	return response
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
