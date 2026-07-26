import type { Page } from "@playwright/test";

/**
 * Waits until nothing on the page is still deciding what it looks like.
 *
 * Two things move after the markup is in place, and each is a source of a
 * screenshot that differs from the last for reasons that have nothing to do
 * with the design.
 *
 * **Fonts.** The three faces are self-hosted, so nothing here depends on a CDN
 * being reachable (#22) — but a local file is still a file, and a page
 * photographed before the face lands is photographed in a fallback. Every
 * metric changes with it: line breaks, box heights, the lot.
 *
 * **Rain.** Seeded, `DigitalRain` draws a fixed number of frames and then marks
 * its canvas settled. Photographing before that mark catches a partial
 * composition, which is a different picture every time by a different route.
 *
 * **Scroll position.** Clicking a control below the fold scrolls it into view
 * first, so a phone-width screen ends up photographed from wherever the last
 * click left it — which put the entire header outside the frame of the mobile
 * error baseline, and would move again the moment anything above it changed
 * height. Every shot is taken from the top, which is where the design's frames
 * are drawn from.
 */
export async function settled(page: Page): Promise<void> {
  await page.evaluate(async () => {
    window.scrollTo(0, 0);
    await document.fonts.ready;
  });

  await page.waitForFunction(() =>
    Array.from(
      document.querySelectorAll<HTMLCanvasElement>("canvas[data-testid='digital-rain']"),
    ).every((canvas) => canvas.dataset.rainSettled === "true"),
  );
}
