# The judge's in-container harness.
#
# It arrives on the interpreter's stdin, carrying the Pattern's tests and the
# submitted source base64-encoded inside itself. Encoding rather than
# interpolating means there is no quoting to get wrong: no submitted source, and
# no test, can end the literal early and become harness code.
#
# THE SUBMITTED SOURCE DOES NOT RUN IN THIS PROCESS.
#
# This process holds two things the submitted source must never reach: the
# report channel that decides the Verdict, and the Pattern's expected answers.
# An earlier version of this harness ran the source here, in the same
# interpreter, with a private file descriptor and a nonce for the report. Both
# were reachable — sys.modules["__main__"] hands out everything a module holds —
# and both were reached: a solution that computed nothing wrote itself a Passed
# Verdict, and another returned every Hidden Test to the caller. Only Passed
# Solve Runs are ranked, and a Hidden Test is hidden only while nobody can read
# it, so neither was a hardening nicety.
#
# So the source runs in a child process handed the source and the calls to make,
# and nothing else. Inputs cross; expected answers never do. The report
# descriptor is not in the child's pass_fds, so close_fds shuts it before the
# child's first instruction. Guessing a Hidden Test's answer is still possible —
# it is called solving the Pattern.
#
# The harness never decides a Verdict. It reports what happened; the supervising
# process decides, because it is the only side that knows about the things that
# stop this program from reporting at all — the wall clock, the memory cap and
# the output cap.
import ast
import base64
import json
import os
import subprocess
import sys

# Take a private copy of the real stderr, then point fd 2 at stdout.
#
# After this, everything the child prints — stdout, tracebacks, or a raw write
# to fd 1 or 2 — lands on the single stream the supervisor caps and collects,
# while the report travels on a descriptor the child does not inherit.
_REPORT_FD = os.dup(2)
os.dup2(1, 2)

# Stop this process being ptraced by the child.
#
# The child runs as the same uid and same-uid ptrace needs no capability, so
# without some defence a submitted source could read the expected answers
# straight out of this process's memory, and moving them to another process
# would have bought nothing.
#
# On a host with kernel.yama.ptrace_scope >= 1 the kernel already refuses:
# a process may trace its descendants, not its ancestors. That is what denies it
# on the machines this was measured on, so this call is the belt to yama's
# braces — it is what holds when ptrace_scope is 0. PR_SET_DUMPABLE(0) makes
# /proc/self/mem root-owned and PTRACE_ATTACH from the same uid fail; it was
# confirmed to take effect on this image, dumpable going 1 to 0.
#
# If it cannot be applied the harness still runs, and the judge's own tests
# assert the parent's memory is unreadable either way.
try:
    import ctypes

    ctypes.CDLL(None, use_errno=True).prctl(4, 0, 0, 0, 0)  # PR_SET_DUMPABLE, 0
except BaseException:
    pass

_payload = json.loads(base64.b64decode("__PAYLOAD__").decode("utf-8"))
_nonce = _payload["nonce"]
_tests = _payload["tests"]

_report = {
    "verdict": "error",
    "passed": 0,
    "total": len(_tests),
    "detail": "",
    "killedBySignal": 0,
}


def _emit():
    # The nonce is fresh per execution. Nothing in the child can write to this
    # descriptor; the nonce is what separates the report from a message the
    # container runtime itself might put on the same stream.
    os.write(_REPORT_FD, (_nonce + json.dumps(_report) + "\n").encode("utf-8"))
    sys.exit(0)


def _tail(text, limit=800):
    text = text.strip()
    # The tail, not the head: the last frames of a traceback are the ones that
    # say what went wrong.
    return text if len(text) <= limit else "..." + text[-limit:]


def _canonical(value):
    # One encoding for both sides, so comparison never depends on how a value
    # happens to be spelled. A tuple and a list of the same items compare equal
    # here; for the shapes a Pattern's entry point returns, that is the
    # forgiving behaviour we want.
    return json.dumps(value, sort_keys=True)


# The program the child runs. It holds no expectations — only whatever arrives
# on its request pipe — so everything in it is safe for the submitted source to
# read, which is just as well, since it is visible in the child's own argv.
_DRIVER = r'''
import json
import os
import sys
import traceback

_requests = os.fdopen(int(sys.argv[1]), "r")
_answers = os.fdopen(int(sys.argv[2]), "w")


def _reply(message):
    _answers.write(json.dumps(message) + "\n")
    _answers.flush()


def _tail(text, limit=800):
    text = text.strip()
    return text if len(text) <= limit else "..." + text[-limit:]


_namespace = {"__name__": "__solution__"}
try:
    _first = json.loads(_requests.readline())
except BaseException:
    sys.exit(0)

try:
    # __name__ is deliberately not "__main__": a stray main block is not part
    # of the solution.
    exec(compile(_first["source"], "solution.py", "exec"), _namespace)
except BaseException:
    _reply({"loaded": False, "error": _tail(traceback.format_exc())})
    sys.exit(0)
_reply({"loaded": True})

for _line in _requests:
    try:
        _call = json.loads(_line)["call"]
    except BaseException:
        break
    try:
        # A shallow copy per call, so a test that rebinds a name cannot change
        # what the next one sees.
        _value = eval(compile(_call, "<call>", "eval"), dict(_namespace))
    except BaseException:
        _reply({"ok": False, "error": _tail(traceback.format_exc())})
        continue
    try:
        _encoded = json.dumps(_value, sort_keys=True)
    except BaseException:
        _reply({"ok": False,
                "error": "the entry point returned a %s, which the judge cannot compare"
                         % type(_value).__name__})
        continue
    _reply({"ok": True, "value": _encoded})
'''

# --- Run the submitted source, somewhere else -------------------------------

_requests_r, _requests_w = os.pipe()
_answers_r, _answers_w = os.pipe()

try:
    _child = subprocess.Popen(
        [sys.executable, "-I", "-u", "-c", _DRIVER, str(_requests_r), str(_answers_w)],
        stdin=subprocess.DEVNULL,
        # The container's own stdout, which the supervisor caps. The child's
        # printing must not reach the request or answer pipes.
        stdout=1,
        stderr=1,
        # close_fds shuts every descriptor except these two. _REPORT_FD is not
        # among them, and that is the whole defence.
        close_fds=True,
        pass_fds=(_requests_r, _answers_w),
    )
except BaseException:
    _report["detail"] = "the judge could not start the execution process"
    _emit()

os.close(_requests_r)
os.close(_answers_w)
_to_child = os.fdopen(_requests_w, "w")
_from_child = os.fdopen(_answers_r, "r")


_child_is_gone = False


def _ask(message):
    # Every failure mode of a dead child comes back as None: a broken pipe on
    # the way out, an empty read on the way back, or a half-written line. The
    # caller cannot tell them apart and does not need to — the answer is
    # missing, and a missing answer is not a passed test.
    global _child_is_gone
    if _child_is_gone:
        return None
    try:
        _to_child.write(json.dumps(message) + "\n")
        _to_child.flush()
        line = _from_child.readline()
    except BaseException:
        # A BrokenPipeError here means the child died mid-question, which is
        # what a memory cap looks like from this side. Stop asking: every
        # further write would raise the same way.
        _child_is_gone = True
        return None
    if not line:
        _child_is_gone = True
        return None
    try:
        return json.loads(line)
    except ValueError:
        return None


_loaded = _ask({"source": _payload["source"]})
if _loaded is None or not _loaded.get("loaded"):
    # The source never ran, so no test can be said to have failed. Every test is
    # still counted, so the player sees how much was at stake.
    _report["detail"] = _tail((_loaded or {}).get("error") or "the submitted source did not start")
    _emit()

# Only the call crosses. The expected answer stays here.
_answers = [_ask({"call": _test["call"]}) for _test in _tests]

# Closing a pipe whose reader has died raises, and buffered bytes are flushed on
# close — so this is not the place to find out the child is gone. Nothing after
# this point may raise, or the report never gets written and a contained memory
# exhaustion is reported as the judge losing track of the container.
try:
    _to_child.close()
except BaseException:
    pass
try:
    _child.wait(timeout=5)
except BaseException:
    _child.kill()
if _child.returncode is not None and _child.returncode < 0:
    # Killed by a signal rather than exiting. The supervising process reads this
    # as the memory cap: the OOM killer picks the process doing the allocating,
    # which is the child, so this process survives to report it.
    _report["killedBySignal"] = -_child.returncode

# --- Only now are the expected answers looked at ----------------------------

_passed = 0
_revealed = ""

for _test, _answer in zip(_tests, _answers):
    # literal_eval, not eval: an expected answer is data, and must never be able
    # to run however the catalogue is edited in future.
    _expected = _canonical(ast.literal_eval(_test["expected"]))

    if _answer is None:
        _ok = False
        _why = "the submitted source stopped running before this test finished"
    elif not _answer.get("ok"):
        _ok = False
        _why = _tail(_answer.get("error") or "the entry point raised")
    else:
        _ok = _answer.get("value") == _expected
        _why = "expected %s, got %s" % (_expected, _answer.get("value"))

    if _ok:
        _passed += 1
    elif _test["revealed"] and not _revealed:
        # Only an Example Test's failure is revealed, and only an Example Test's
        # expected answer appears in it. A Hidden Test's failure is reported as
        # a count and nothing else (CONTEXT.md).
        _revealed = _test["name"] + ": " + _why

_report["passed"] = _passed
_report["verdict"] = "passed" if _passed == len(_tests) else "failed"
_report["detail"] = _revealed
_emit()
