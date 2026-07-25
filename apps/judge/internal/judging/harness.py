# The judge's in-container harness.
#
# It arrives on the interpreter's stdin, carrying the submitted source and the
# Pattern's tests base64-encoded inside itself. Encoding rather than
# interpolating means there is no quoting to get wrong: no submitted source, and
# no test expression, can end the literal early and become harness code.
#
# The harness never decides a Verdict. It reports what happened; the supervising
# process decides, because it is the only side that knows about the things that
# stop this program from reporting at all — the wall clock, the memory cap and
# the output cap.
import base64
import json
import os
import sys
import traceback

# Take a private copy of the real stderr, then point fd 2 at stdout.
#
# After this, everything the submitted source emits — print, tracebacks, or a
# raw os.write to fd 1 or 2 — lands on the single stream the supervisor caps and
# collects, while the report travels on a descriptor the source has no reason to
# know about. Without the split, a program that prints enough to trip the output
# cap would also carry the report over the cliff with it.
_REPORT_FD = os.dup(2)
os.dup2(1, 2)

_payload = json.loads(base64.b64decode("__PAYLOAD__").decode("utf-8"))
_nonce = _payload["nonce"]
_tests = _payload["tests"]

_report = {
    "outcome": "error",
    "passed": 0,
    "total": len(_tests),
    "detail": "",
}


def _emit():
    # The nonce is fresh per execution. It is not a security boundary — code
    # running in this interpreter can reach anything in it — but it means a
    # program that happens to print JSON cannot be mistaken for the report.
    os.write(_REPORT_FD, (_nonce + json.dumps(_report) + "\n").encode("utf-8"))


def _tail(text, limit=800):
    text = text.strip()
    # The tail, not the head: the last frames of a traceback are the ones that
    # say what went wrong.
    return text if len(text) <= limit else "..." + text[-limit:]


# The submitted source runs in its own namespace, not this module's, so it
# cannot shadow the harness's own names by accident. __name__ is deliberately
# not "__main__": a stray main block is not part of the solution.
_namespace = {"__name__": "__solution__"}

try:
    exec(compile(_payload["source"], "solution.py", "exec"), _namespace)
except BaseException:
    # The source never ran, so no test can be said to have failed. Every test
    # is still counted, so the player sees how much was at stake.
    _report["detail"] = _tail(traceback.format_exc())
    _emit()
    sys.exit(0)

_passed = 0
_revealed = ""

for _test in _tests:
    try:
        # A shallow copy per test, so a test that mutates a binding cannot
        # change the result of the next one.
        _ok = bool(eval(compile(_test["expression"], "<test>", "eval"), dict(_namespace)))
        _why = "the expression was not true"
    except BaseException:
        _ok = False
        _why = _tail(traceback.format_exc())

    if _ok:
        _passed += 1
    elif _test["revealed"] and not _revealed:
        # Only an Example Test's failure is revealed. A Hidden Test's failure is
        # reported as a count and nothing else (CONTEXT.md).
        _revealed = _test["name"] + ": " + _why

_report["passed"] = _passed
_report["outcome"] = "passed" if _passed == len(_tests) else "failed"
_report["detail"] = _revealed
_emit()
