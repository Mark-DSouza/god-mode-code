package sandbox_test

import (
	"testing"
	"time"

	"github.com/Mark-DSouza/god-mode-code/apps/judge/internal/sandbox"
)

// The limits can be overridden from the environment, so a malformed value has
// to stop the service at startup. Without validation the service starts, calls
// itself healthy, and returns an Error for every Solve Run — a misconfiguration
// wearing an outage's clothes.
func TestLimitsValidation(t *testing.T) {
	t.Parallel()

	if err := sandbox.DefaultLimits().Validate(); err != nil {
		t.Fatalf("the production defaults do not validate: %v", err)
	}

	bend := func(change func(*sandbox.Limits)) sandbox.Limits {
		limits := sandbox.DefaultLimits()
		change(&limits)
		return limits
	}

	cases := map[string]sandbox.Limits{
		"memory with no unit": bend(func(l *sandbox.Limits) { l.Memory = "128" }),
		"memory of zero":      bend(func(l *sandbox.Limits) { l.Memory = "0m" }),
		"nonsense memory":     bend(func(l *sandbox.Limits) { l.Memory = "lots" }),
		"tmpfs with no unit":  bend(func(l *sandbox.Limits) { l.TmpfsSize = "16" }),
		"cpus not a number":   bend(func(l *sandbox.Limits) { l.CPUs = "half" }),
		"cpus of zero":        bend(func(l *sandbox.Limits) { l.CPUs = "0" }),
		"negative pids":       bend(func(l *sandbox.Limits) { l.Pids = -1 }),
		"no output cap":       bend(func(l *sandbox.Limits) { l.MaxOutputBytes = 0 }),
		"no wall-clock cap":   bend(func(l *sandbox.Limits) { l.Wall = 0 }),
		"negative wall cap":   bend(func(l *sandbox.Limits) { l.Wall = -time.Second }),
	}

	for name, limits := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			if err := limits.Validate(); err == nil {
				t.Errorf("%+v validated, want a refusal", limits)
			}
		})
	}
}
