package judging

import (
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/Mark-DSouza/god-mode-code/apps/judge/internal/pattern"
)

//go:embed harness.py
var harnessSource string

// payloadPlaceholder is what buildHarness swaps for the encoded payload. It
// sits inside a string literal in harness.py so the file stays valid Python and
// can be linted, read and reasoned about on its own.
const payloadPlaceholder = "__PAYLOAD__"

// harnessTest is one test as the harness sees it. Revealed carries the Example
// Test / Hidden Test distinction across the boundary: the harness has to know
// which failures it may describe, because it is the only side that sees them.
type harnessTest struct {
	Name       string `json:"name"`
	Expression string `json:"expression"`
	Revealed   bool   `json:"revealed"`
}

type harnessPayload struct {
	Nonce  string        `json:"nonce"`
	Source string        `json:"source"`
	Tests  []harnessTest `json:"tests"`
}

// report is what the harness writes back on its private descriptor.
type report struct {
	Outcome string `json:"outcome"`
	Passed  int    `json:"passed"`
	Total   int    `json:"total"`
	Detail  string `json:"detail"`
}

// buildHarness produces the complete Python program for one execution.
func buildHarness(p pattern.Pattern, source, nonce string) ([]byte, error) {
	tests := make([]harnessTest, 0, len(p.ExampleTests)+len(p.HiddenTests))
	// Example Tests first: they are the contract the player was shown, so when
	// submitted source is wrong in an obvious way the revealed failure is the one
	// they can act on.
	for _, test := range p.ExampleTests {
		tests = append(tests, harnessTest{Name: test.Name, Expression: test.Expression, Revealed: true})
	}
	for _, test := range p.HiddenTests {
		tests = append(tests, harnessTest{Name: test.Name, Expression: test.Expression, Revealed: false})
	}

	encoded, err := json.Marshal(harnessPayload{Nonce: nonce, Source: source, Tests: tests})
	if err != nil {
		return nil, fmt.Errorf("encoding the harness payload: %w", err)
	}

	program := strings.Replace(harnessSource, payloadPlaceholder,
		base64.StdEncoding.EncodeToString(encoded), 1)
	return []byte(program), nil
}

// findReport pulls the harness's report out of its output stream.
//
// It scans for the nonce rather than parsing the whole stream, because the
// stream may also carry a message from the container runtime — an image that
// will not pull, a flag the daemon rejected — and those are not JSON.
func findReport(raw []byte, nonce string) (report, bool) {
	for _, line := range strings.Split(string(raw), "\n") {
		encoded, found := strings.CutPrefix(strings.TrimSpace(line), nonce)
		if !found {
			continue
		}
		var r report
		if err := json.Unmarshal([]byte(encoded), &r); err != nil {
			continue
		}
		return r, true
	}
	return report{}, false
}
