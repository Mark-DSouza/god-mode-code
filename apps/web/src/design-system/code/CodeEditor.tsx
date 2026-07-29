import { type CSSProperties, type KeyboardEvent, type Ref, useId } from "react";
import { cn } from "../cn.ts";

export interface CodeEditorProps {
  /** The Pattern's read-only lines, shown above and never editable. */
  scaffold: string;
  /** What the player has written below it. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  inputRef?: Ref<HTMLTextAreaElement>;
  className?: string;
  style?: CSSProperties;
}

/** What one Tab inserts. Four spaces, because this is Python. */
const INDENT = "    ";

/**
 * A line-numbered editor whose first lines cannot be touched.
 *
 * <h2>Two elements, not one</h2>
 *
 * The Scaffold is rendered as text and the editable region is a real
 * `<textarea>` below it. The obvious alternative — one textarea holding both,
 * with a caret guard rejecting edits above a line — is the version that looks
 * simpler and behaves worse: select-all-and-type, paste over the whole
 * document, undo, and a soft keyboard's autocorrect all rewrite the protected
 * lines through paths a keydown handler never sees. Making the Scaffold
 * something the browser cannot put a caret in is the guarantee, and the
 * guarantee matters — the Scaffold is half of every program the judge executes,
 * and a player who edited the signature would fail every test for a reason
 * nobody could see.
 *
 * The Scaffold is also `aria-hidden` and not focusable, so a keyboard user Tabs
 * straight into the region they can write in rather than through lines they
 * cannot. It is offered to assistive technology through the textarea's own
 * description instead, which is where a screen reader user actually needs it.
 *
 * <h2>Tab indents</h2>
 *
 * Tab inserts four spaces rather than moving focus, because Python without
 * indentation is not writable. That is a deliberate keyboard trap for one key,
 * and the way out is the one browsers already teach: Escape then Tab, plus a
 * visible hint saying so. Shift+Tab is left alone, so the region is never a
 * dead end.
 */
export function CodeEditor({
  scaffold,
  value,
  onChange,
  disabled = false,
  inputRef,
  className,
  style,
}: CodeEditorProps) {
  const scaffoldId = useId();
  const scaffoldLines = scaffold.split("\n");
  const writtenLines = value.split("\n");

  function indentOnTab(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab" || event.shiftKey) return;
    event.preventDefault();

    const field = event.currentTarget;
    const { selectionStart, selectionEnd } = field;
    onChange(value.slice(0, selectionStart) + INDENT + value.slice(selectionEnd));

    // The caret goes after the spaces that were just inserted. React will
    // re-render with the new value and put the caret at the end otherwise,
    // which sends it to the bottom of the file mid-line.
    queueMicrotask(() =>
      field.setSelectionRange(selectionStart + INDENT.length, selectionStart + INDENT.length),
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-line bg-surface-1 font-code text-sm",
        className,
      )}
      style={style}
    >
      {/* Locked. Rendered as text, in a container nothing can focus, so there
          is no caret to guard rather than a guard to get right. */}
      <div aria-hidden="true" className="flex bg-surface-2">
        <LineNumbers from={1} count={scaffoldLines.length} />
        <pre className="flex-1 overflow-x-auto py-2 pr-4 pl-3 leading-[1.6] text-ink-2">
          <code>{scaffold}</code>
        </pre>
      </div>

      {/* The marker. A player has to be able to see where the Pattern stops and
          they start, without discovering it by trying to type in the wrong
          place. */}
      <div className="flex items-center gap-2 border-y border-line bg-surface-3 px-3 py-1">
        <span aria-hidden="true" className="text-accent">
          ▸
        </span>
        <span className="font-display text-2xs tracking-wider text-muted uppercase">
          your lines
        </span>
      </div>

      <div className="flex">
        <LineNumbers from={scaffoldLines.length + 1} count={writtenLines.length} />
        <textarea
          ref={inputRef}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={indentOnTab}
          // A four-line answer is trivially pasteable (ADR-0004), and the Typing
          // Run's surface refuses a paste for the same reason. Detectable only
          // because this is a real form control: a focusable div has no paste
          // event to prevent.
          onPaste={(event) => event.preventDefault()}
          aria-label="Write your solution"
          aria-describedby={scaffoldId}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          rows={Math.max(6, writtenLines.length + 1)}
          // 16px is the threshold below which iOS Safari zooms the page when an
          // input takes focus. It is a phone behaviour, not a look.
          className={cn(
            "flex-1 resize-none border-0 bg-transparent py-2 pr-4 pl-3 text-[16px] leading-[1.6] text-body sm:text-sm",
            "caret-accent outline-none placeholder:text-disabled",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        />
      </div>

      {/* The Scaffold, once, as running text an assistive technology can read —
          the line-numbered rendering above is decoration by comparison. */}
      <p id={scaffoldId} className="sr-only">
        {`Your lines continue this code: ${scaffold}`}
      </p>
    </div>
  );
}

/**
 * The gutter. Continuous across both regions, because they are one file: the
 * player's first line really is line two of the program that gets executed.
 */
function LineNumbers({ from, count }: { from: number; count: number }) {
  return (
    <div
      aria-hidden="true"
      className="shrink-0 border-r border-line bg-surface-3 px-3 py-2 text-right text-disabled select-none"
    >
      {Array.from({ length: count }, (_, offset) => (
        <div key={from + offset} className="leading-[1.6]">
          {from + offset}
        </div>
      ))}
    </div>
  );
}
