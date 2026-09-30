import type { BrowserCommand } from 'vitest/node';

// Node-side commands for the browser project. Each runs in the vitest
// process with the Playwright handles for the tester page; a test calls it
// through `commands` from 'vitest/browser'.

// Flip the OS reduced-motion preference for the tester page. The card reads
// `matchMedia('(prefers-reduced-motion: reduce)')` at construction and
// `.matches` at use, so emulating the media feature exercises the real
// MediaQueryList instead of a stand-in.
export const setReducedMotion: BrowserCommand<[on: boolean]> = async ({ page }, on) => {
  await page.emulateMedia({ reducedMotion: on ? 'reduce' : 'no-preference' });
};

// Press the real mouse on alert row `index` and drag it `dx` CSS px to the
// left, leaving the button down so the test can assert on the captured
// gesture. Playwright's CSS engine pierces the card's shadow root, and
// boundingBox() is relative to the main frame, which is what page.mouse
// wants.
export const mouseDrag: BrowserCommand<[index: number, dx: number]> = async ({ page, iframe }, index, dx) => {
  const box = await iframe.locator('weather-alerts-card .alert-card').nth(index).boundingBox();
  if (!box) throw new Error(`alert row ${index} has no layout box`);
  const x = box.x + box.width * 0.8;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - dx, y, { steps: 4 });
};

export const mouseUp: BrowserCommand<[]> = async ({ page }) => {
  await page.mouse.up();
};

declare module 'vitest/browser' {
  interface BrowserCommands {
    setReducedMotion: (on: boolean) => Promise<void>;
    mouseDrag: (index: number, dx: number) => Promise<void>;
    mouseUp: () => Promise<void>;
  }
}
