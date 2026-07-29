import { Card } from "../design-system/index.ts";

/**
 * Says out loud, on a phone, that this Discipline wants a keyboard.
 *
 * Not a block and not a redirect. Everything on the Code screens works on a
 * touch device — the editor is a real textarea and raises a soft keyboard like
 * any other — but writing indented Python on a phone keyboard is a worse
 * experience than the site can fix, and letting somebody discover that four
 * lines into a twenty-minute window is the unkind version.
 *
 * Hidden from `sm` upwards rather than rendered conditionally on a width the
 * component measured. A media query is the browser's own answer to this
 * question and it is correct during the first paint; anything that reads
 * `window.innerWidth` is wrong until an effect has run.
 */
export function DesktopSuitsThisBetter() {
  return (
    <Card className="text-center sm:hidden">
      <p className="font-body text-sm text-muted">
        The Code Discipline suits a desktop. You can play here, but a real keyboard is worth the
        wait.
      </p>
    </Card>
  );
}
