// Package pattern holds the judge's catalogue of Patterns and their tests.
//
// The catalogue is compiled into the binary. It has to be: the judge runs on an
// instance with no credentials and no egress (ADR-0005), so it cannot read
// Hidden Tests out of the database at judging time, and there is nowhere to
// fetch them from. A single static binary carrying its own catalogue is the
// whole deployment.
//
// Hidden Tests living in the judge binary rather than in the backend is also
// what keeps them hidden: the backend never has to hold them, so it can never
// leak them over an endpoint.
package pattern

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"sort"
	"strings"
)

//go:embed catalogue/*.json
var catalogueFS embed.FS

// Test is one assertion a submitted source must satisfy. Expression is a Python
// expression evaluated in the namespace the submitted source defines; it counts
// as satisfied when it evaluates truthy without raising.
type Test struct {
	Name       string `json:"name"`
	Expression string `json:"expression"`
}

// Pattern is a distilled algorithmic technique posed as a puzzle, together with
// the tests a Solve Run is judged against.
type Pattern struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Family    string `json:"family"`
	Seniority string `json:"seniority"`
	// EntryPoint is the function the tests call. It is not enforced here —
	// a submitted source that never defines it simply fails every test.
	EntryPoint string `json:"entryPoint"`
	// Scaffold is the read-only region shown above the player's editable lines.
	// The judge does not use it; it travels with the Pattern so the catalogue
	// stays one description of one thing.
	Scaffold string `json:"scaffold"`
	// ExampleTests are shown to the player, so their failure is revealed in
	// full. HiddenTests are never shown, so their failure is only ever a count
	// (CONTEXT.md).
	ExampleTests []Test `json:"exampleTests"`
	HiddenTests  []Test `json:"hiddenTests"`
}

// Catalogue is the set of Patterns this judge can judge.
type Catalogue struct {
	byID map[string]Pattern
}

// Embedded loads the catalogue compiled into the binary. It validates on load
// rather than at judging time, so a malformed catalogue stops the service at
// startup instead of turning every Solve Run into an Error.
func Embedded() (*Catalogue, error) {
	entries, err := fs.Glob(catalogueFS, "catalogue/*.json")
	if err != nil {
		return nil, fmt.Errorf("listing the catalogue: %w", err)
	}

	byID := make(map[string]Pattern, len(entries))
	for _, entry := range entries {
		raw, err := catalogueFS.ReadFile(entry)
		if err != nil {
			return nil, fmt.Errorf("reading %s: %w", entry, err)
		}

		var p Pattern
		decoder := json.NewDecoder(strings.NewReader(string(raw)))
		// A typo in a field name would otherwise produce a Pattern with no
		// Hidden Tests, which judges every submitted source as Passed.
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&p); err != nil {
			return nil, fmt.Errorf("decoding %s: %w", entry, err)
		}
		if err := p.validate(entry); err != nil {
			return nil, err
		}
		if _, clash := byID[p.ID]; clash {
			return nil, fmt.Errorf("%s: duplicate Pattern identifier %q", entry, p.ID)
		}
		byID[p.ID] = p
	}

	if len(byID) == 0 {
		return nil, fmt.Errorf("the catalogue is empty")
	}
	return &Catalogue{byID: byID}, nil
}

func (p Pattern) validate(source string) error {
	switch {
	case p.ID == "":
		return fmt.Errorf("%s: a Pattern needs an identifier", source)
	case p.EntryPoint == "":
		return fmt.Errorf("%s: Pattern %q needs an entry point", source, p.ID)
	case len(p.HiddenTests) == 0:
		// Without Hidden Tests every submitted source passes, which is a
		// silently wrong Verdict rather than a loud failure.
		return fmt.Errorf("%s: Pattern %q has no Hidden Tests", source, p.ID)
	}
	for _, test := range append(append([]Test{}, p.ExampleTests...), p.HiddenTests...) {
		if test.Name == "" || test.Expression == "" {
			return fmt.Errorf("%s: Pattern %q has a test with no name or no expression", source, p.ID)
		}
	}
	return nil
}

// Lookup finds a Pattern by its identifier.
func (c *Catalogue) Lookup(id string) (Pattern, bool) {
	p, ok := c.byID[id]
	return p, ok
}

// IDs lists every Pattern identifier, sorted, for logging and diagnostics.
func (c *Catalogue) IDs() []string {
	ids := make([]string, 0, len(c.byID))
	for id := range c.byID {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

// Len reports how many Patterns the catalogue holds.
func (c *Catalogue) Len() int { return len(c.byID) }
