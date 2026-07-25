package pattern_test

import (
	"testing"

	"github.com/Mark-DSouza/god-mode-code/apps/judge/internal/pattern"
)

// The catalogue is compiled in, so a malformed entry is a build-time asset that
// only fails at runtime. This is the test that turns it back into a build
// failure.
func TestEmbeddedCatalogueLoads(t *testing.T) {
	t.Parallel()

	catalogue, err := pattern.Embedded()
	if err != nil {
		t.Fatalf("loading the embedded catalogue: %v", err)
	}
	if catalogue.Len() == 0 {
		t.Fatal("the catalogue is empty")
	}

	for _, id := range catalogue.IDs() {
		p, ok := catalogue.Lookup(id)
		if !ok {
			t.Fatalf("IDs listed %q but Lookup did not find it", id)
		}
		// A Pattern with no Hidden Tests judges every submitted source as
		// Passed, which is a silently wrong Verdict — the worst kind.
		if len(p.HiddenTests) == 0 {
			t.Errorf("Pattern %q has no Hidden Tests", id)
		}
		if len(p.ExampleTests) == 0 {
			t.Errorf("Pattern %q has no Example Tests, so a player cannot see the contract", id)
		}
		if p.Family == "" || p.Seniority == "" {
			t.Errorf("Pattern %q is missing its Family or Seniority", id)
		}
	}
}

func TestUnknownPatternIsNotFound(t *testing.T) {
	t.Parallel()

	catalogue, err := pattern.Embedded()
	if err != nil {
		t.Fatalf("loading the embedded catalogue: %v", err)
	}
	if _, ok := catalogue.Lookup("no-such-pattern"); ok {
		t.Error("Lookup found a Pattern that does not exist")
	}
}
