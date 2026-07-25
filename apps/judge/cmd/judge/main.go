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
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Mark-DSouza/god-mode-code/apps/judge/internal/api"
)

const (
	defaultAddr = ":9090"

	// Generous relative to a request, because a judge execution is bounded by
	// its own wall-clock timeout well inside this.
	readHeaderTimeout = 5 * time.Second
	shutdownTimeout   = 15 * time.Second
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

	server := &http.Server{
		Addr:              addr,
		Handler:           api.New(version, api.WithLogger(log)).Handler(),
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
