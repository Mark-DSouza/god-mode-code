package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// The judge must never be handed a container socket.
//
// ADR-0005 permits mounting it in local development, for convenience. This
// project declines that convenience — compose.e2e.yaml explains why — and a
// comment saying so is worth exactly as much as the next person's attention.
// This is the part that does not get tired: mounting the socket into the one
// service whose job is executing hostile code is the single change here that
// turns a sandbox into a foothold on the host.
func TestComposeNeverMountsTheContainerSocket(t *testing.T) {
	t.Parallel()

	// From this package's directory up to the repository root.
	root := filepath.Join("..", "..", "..", "..")
	files, err := filepath.Glob(filepath.Join(root, "compose.*.yaml"))
	if err != nil {
		t.Fatalf("looking for compose files: %v", err)
	}
	if len(files) == 0 {
		// A rename or a move must fail here rather than silently stop checking.
		t.Fatalf("no compose files found under %s — this guard is no longer looking anywhere", root)
	}

	for _, file := range files {
		contents, err := os.ReadFile(file)
		if err != nil {
			t.Fatalf("reading %s: %v", file, err)
		}
		for _, socket := range []string{
			"docker.sock",
			"containerd.sock",
			"podman.sock",
			"/run/docker",
		} {
			if strings.Contains(string(contents), socket) {
				t.Errorf("%s references %s: a container socket must never be mounted into this stack (ADR-0005)",
					filepath.Base(file), socket)
			}
		}
	}
}
