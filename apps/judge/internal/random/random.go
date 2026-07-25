// Package random makes unguessable identifiers.
//
// It exists so the sandbox's container names and the harness's report nonce
// share one implementation. Both are guessing targets — a predictable container
// name is something to race, a predictable nonce is something to spell — so
// both want a cryptographic source, and having that judgement written down once
// is better than having it written down twice identically.
package random

import (
	"crypto/rand"
	"encoding/hex"
)

// Hex returns n random bytes, hex-encoded.
func Hex(n int) string {
	buf := make([]byte, n)
	// crypto/rand.Read never returns an error on any supported platform: since
	// Go 1.24 it panics internally if the OS source fails, which is the right
	// way for a process whose isolation depends on these being unguessable to fail.
	_, _ = rand.Read(buf)
	return hex.EncodeToString(buf)
}
