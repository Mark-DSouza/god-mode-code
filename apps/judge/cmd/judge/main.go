// Command judge runs the GOD_MODE_CODE judge service.
//
// It runs as a host process and is deliberately not containerised. Putting it
// in a container would mean mounting the container socket so it could start
// sandboxes, and a mounted container socket is the most direct escape path
// available to the hostile code this service exists to contain (ADR-0005).
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/Mark-DSouza/god-mode-code/apps/judge/internal/api"
	"github.com/Mark-DSouza/god-mode-code/apps/judge/internal/judging"
	"github.com/Mark-DSouza/god-mode-code/apps/judge/internal/metrics"
	"github.com/Mark-DSouza/god-mode-code/apps/judge/internal/pattern"
	"github.com/Mark-DSouza/god-mode-code/apps/judge/internal/sandbox"
)

const (
	defaultAddr = ":9090"

	// Two containers alongside the supervisor is what fits in the 1GB instance
	// this service is sized for (ADR-0005).
	defaultWorkers = 2

	// Generous relative to a request, because a judge execution is bounded by
	// its own wall-clock timeout well inside this.
	readHeaderTimeout = 5 * time.Second
	shutdownTimeout   = 15 * time.Second

	// How long to wait on the container runtime at startup before concluding
	// there isn't one.
	runtimeProbeTimeout = 10 * time.Second
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(log)

	if err := run(log); err != nil {
		log.Error("judge exited", slog.Any("error", err))
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	addr := envOr("JUDGE_ADDR", defaultAddr)
	version := envOr("JUDGE_VERSION", "dev")
	registry := metrics.NewRegistry(version)

	catalogue, err := pattern.Embedded()
	if err != nil {
		// Fatal on purpose. A judge with a broken catalogue would answer every
		// Solve Run with an Error, which looks like an outage while reading
		// like a healthy service.
		return fmt.Errorf("loading the Pattern catalogue: %w", err)
	}
	log.Info("loaded the Pattern catalogue",
		slog.Int("patterns", catalogue.Len()), slog.Any("ids", catalogue.IDs()))

	options := []api.Option{api.WithLogger(log), api.WithMetrics(registry)}

	limits := limitsFromEnv(log)
	if err := limits.Validate(); err != nil {
		// Fatal, because the alternative is a service that starts, reports
		// itself healthy, and then returns an Error for every Solve Run.
		return fmt.Errorf("sandbox limits: %w", err)
	}

	runner := sandbox.New(sandbox.Options{
		Limits:  limits,
		Logger:  log,
		Metrics: registry,
	})

	// Probed once at startup rather than discovered on the first Solve Run. A
	// judge that cannot judge should say so on /health, not accept work and
	// return an Error for all of it.
	probeCtx, cancelProbe := context.WithTimeout(context.Background(), runtimeProbeTimeout)
	err = runner.Available(probeCtx)
	cancelProbe()

	if err != nil {
		// Not fatal. In the containerised local stack the judge deliberately
		// has no runtime — giving it one would mean mounting the container
		// socket, which is the most direct escape path available to the code
		// this service exists to contain (ADR-0005). It serves DEGRADED there.
		//
		log.Warn("no container runtime; serving without judging", slog.Any("error", err))
		// Shut the runner down rather than leave it running: its reaper would
		// otherwise fail to reach the daemon every thirty seconds for the life
		// of the process, filling the one log stream this host keeps.
		_ = runner.Close()
	} else {
		defer func() { _ = runner.Close() }()
		workers := intFromEnv(log, "JUDGE_WORKERS", defaultWorkers)
		options = append(options, api.WithJudge(judging.New(judging.Options{
			Sandbox:  runner,
			Patterns: catalogue,
			Workers:  workers,
			Metrics:  registry,
			Logger:   log,
		})))
		// The effective limits are logged in full, not just the overridden
		// ones: when something escapes, the first question is what the sandbox
		// was actually set to, and this host's stdout is the only place that
		// answer lives (ADR-0005).
		log.Info("judging enabled",
			slog.Int("workers", workers),
			slog.String("image", sandbox.DefaultImage),
			slog.String("containerLabel", runner.Label()),
			slog.String("memory", limits.Memory),
			slog.String("cpus", limits.CPUs),
			slog.Int("pids", limits.Pids),
			slog.String("tmpfsSize", limits.TmpfsSize),
			slog.Int64("maxOutputBytes", limits.MaxOutputBytes),
			slog.Duration("wall", limits.Wall))
	}

	server := &http.Server{
		Addr:              addr,
		Handler:           api.New(version, options...).Handler(),
		ReadHeaderTimeout: readHeaderTimeout,
	}

	// Signal handling is set up before the listener opens, so a container that
	// is stopped during startup still shuts down rather than being killed.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	listenErr := make(chan error, 1)
	go func() {
		log.Info("judge listening", slog.String("addr", addr), slog.String("version", version))
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			listenErr <- err
			return
		}
		listenErr <- nil
	}()

	select {
	case err := <-listenErr:
		return err
	case <-ctx.Done():
		log.Info("shutting down")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	return server.Shutdown(shutdownCtx)
}

func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

// limitsFromEnv lets an operator tune the sandbox without a rebuild — which
// matters on a host chosen for how little memory it has. The defaults are the
// ones the tests exercise; whatever comes out of here is validated before the
// service starts and logged in full once it does.
func limitsFromEnv(log *slog.Logger) sandbox.Limits {
	limits := sandbox.DefaultLimits()
	limits.Memory = envOr("JUDGE_MEMORY", limits.Memory)
	limits.CPUs = envOr("JUDGE_CPUS", limits.CPUs)
	limits.TmpfsSize = envOr("JUDGE_TMPFS_SIZE", limits.TmpfsSize)
	limits.Pids = intFromEnv(log, "JUDGE_PIDS", limits.Pids)
	limits.MaxOutputBytes = int64(intFromEnv(log, "JUDGE_MAX_OUTPUT_BYTES", int(limits.MaxOutputBytes)))

	if seconds := intFromEnv(log, "JUDGE_TIMEOUT_SECONDS", int(limits.Wall.Seconds())); seconds > 0 {
		limits.Wall = time.Duration(seconds) * time.Second
	}
	return limits
}

// intFromEnv reads a positive integer, falling back loudly. A typo in a limit
// must not silently become a smaller limit — or a larger one.
func intFromEnv(log *slog.Logger, key string, fallback int) int {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		log.Warn("ignoring an unreadable setting",
			slog.String("key", key), slog.String("value", raw), slog.Int("using", fallback))
		return fallback
	}
	return value
}
