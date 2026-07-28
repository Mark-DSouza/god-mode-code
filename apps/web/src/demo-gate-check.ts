// TEMPORARY. Deliberately vulnerable, to prove the CodeQL gate can fail.
// `window.location.hash` is attacker-controlled and reaches `eval`, which is
// CodeQL's `js/code-injection` at security-severity 9.3.
export function replayFromHash(): void {
  // eslint-disable-next-line no-eval
  eval(decodeURIComponent(window.location.hash.slice(1)));
}
