# The Code Discipline is Pattern puzzles judged by execution

**This decision supersedes the UI mockups.** A future reader comparing
`mockups-and-design-system/` against the implementation will find two designs
that were both rejected, and should not treat either as the specification.

The mockups contain two contradictory models for Code: `data.js` treats it as
short snippets transcribed like a Passage, while `CodeScreen.jsx` and the handoff
README describe a LeetCode-style browser where the player writes an entire
solution. Neither ships.

Transcribing code is just typing with more punctuation — it adds no new skill.
Writing a whole solution produces a five-minute Run in an app whose other
Disciplines take forty seconds, and it makes Accuracy undefined; the mockup
concedes this by hardcoding `accuracy: 97.8` because no honest value exists
without a target text. Instead, a Pattern distills the *technique* — "store what
you've seen, look up what you need" rather than "solve Two Sum" — presented as a
Scaffold plus a 4–8 line editable region, and judged by executing Hidden Tests.
Execution is the only meaningful correctness signal when there is no target to
diff against, and it accepts every valid solution rather than one blessed
phrasing.

## Consequences

- Requires a code execution sandbox, which is why ADR-0005 exists. This is
  roughly a third of the project's effort and is not optional.
- Solve Runs can **fail**, a lifecycle state Typing Runs do not have.
- Curated lists (Blind 75, NeetCode 150) are usable as a *syllabus* of which
  techniques matter. LeetCode's problem statements are copyrighted and are not
  reproduced; Pattern prompts are original descriptions of techniques, and
  techniques are not copyrightable.
- A four-line answer is trivially pasteable, so keystroke count is stored
  alongside character count and implausible divergence is rejected.
