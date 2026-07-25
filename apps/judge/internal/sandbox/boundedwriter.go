package sandbox

import (
	"bytes"
	"sync"
)

// boundedWriter collects at most limit bytes and reports the moment a writer
// tries to exceed it.
//
// It always claims to have written everything. That is deliberate: returning a
// short write or an error would make os/exec stop copying, the container's pipe
// would fill, and a program printing in a loop would block on write — which
// looks, from the outside, exactly like a program that has hung. Instead the
// bytes past the cap are counted and discarded, the reader keeps draining, and
// the run is ended by whoever is listening on exceeded.
type boundedWriter struct {
	limit int64

	mu    sync.Mutex
	kept  bytes.Buffer
	total int64

	// exceeded closes once, the first time the cap is passed.
	exceeded chan struct{}
	once     sync.Once
}

func newBoundedWriter(limit int64) *boundedWriter {
	return &boundedWriter{limit: limit, exceeded: make(chan struct{})}
}

func (w *boundedWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	w.total += int64(len(p))
	if room := w.limit - int64(w.kept.Len()); room > 0 {
		if int64(len(p)) > room {
			w.kept.Write(p[:room])
		} else {
			w.kept.Write(p)
		}
	}
	over := w.total > w.limit
	w.mu.Unlock()

	if over {
		w.once.Do(func() { close(w.exceeded) })
	}
	return len(p), nil
}

// collected returns the retained bytes and whether anything was dropped.
func (w *boundedWriter) collected() ([]byte, bool) {
	w.mu.Lock()
	defer w.mu.Unlock()
	// Copy: the copying goroutine may still be draining a killed container's
	// pipe, and handing out the buffer's own storage would race with it.
	out := make([]byte, w.kept.Len())
	copy(out, w.kept.Bytes())
	return out, w.total > w.limit
}
