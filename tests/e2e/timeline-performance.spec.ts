import { expect, test, type Page } from "@playwright/test";

/**
 * How fast the Timeline draws with 5,000 moments on it (docs/plan/09-timeline.md §The view:
 * "5,000 entries at 60 fps on a mid laptop. Measure it.").
 *
 * The moments come from a fixture page (`/timeline-bench`, src/app/(dev)/timeline-bench/), never
 * from a case: a case holds a few hundred. The view still has to stay smooth at a size a real
 * super-timeline reaches, so it is measured against the bench instead. Adapted from Hacker
 * Simulation's tests/e2e/network-map-performance.spec.ts.
 *
 * Each test records how long every animation frame took during one interaction, prints the whole
 * spread, and then asks two things of it: whether the slow tenth of frames stayed under budget,
 * and whether any single frame blocked the page. Frames are counted with requestAnimationFrame:
 * the gaps between callbacks are the frame times, so work that blocks the main thread stretches
 * them. src/features/timeline/README.md records the numbers.
 */

const ENTRIES = 5000;

/** One frame on a 60 Hz display, plus a little room: a longer gap means a frame was missed. */
const DROPPED_FRAME_MS = 20;

/**
 * The budget, in milliseconds per frame, at the slow end (p90). Frames come in steps of 16.7 ms
 * on a 60 Hz screen, so this sits above the one-missed-frame step (33.3 ms), the same line the
 * network map draws, so one frame stolen by a busy machine doesn't redden a healthy run.
 */
const FRAME_BUDGET_MS = 40;

/** The longest any single frame may take: past this the page has stopped answering. */
const MAX_HITCH_MS = 350;

const MIN_FRAMES = 20;
const IDLE_SAMPLE_MS = 500;

interface FrameStats {
  readonly frames: number;
  readonly p50: number;
  readonly p90: number;
  readonly worst: number;
  readonly fps: number;
  readonly dropped: number;
  readonly droppedShare: number;
}

declare global {
  interface Window {
    __stopFrames?: () => number[];
  }
}

async function startRecording(page: Page): Promise<void> {
  await page.evaluate(() => {
    const times: number[] = [];
    let previous = performance.now();
    let running = true;
    const tick = (now: number) => {
      times.push(now - previous);
      previous = now;
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.__stopFrames = () => {
      running = false;
      return times;
    };
  });
}

const percent = (share: number) => `${(share * 100).toFixed(0)}%`;

function summarise(times: readonly number[]): FrameStats {
  // The first two gaps span the setup call and the frame the interaction started on.
  const measured = [...times.slice(2)].sort((a, b) => a - b);
  const at = (fraction: number) =>
    measured[Math.min(measured.length - 1, Math.floor(measured.length * fraction))] ?? 0;
  const total = measured.reduce((sum, value) => sum + value, 0);
  const dropped = measured.filter((value) => value > DROPPED_FRAME_MS).length;
  return {
    frames: measured.length,
    p50: at(0.5),
    p90: at(0.9),
    worst: measured[measured.length - 1] ?? 0,
    fps: total > 0 ? (measured.length / total) * 1000 : 0,
    dropped,
    droppedShare: measured.length > 0 ? dropped / measured.length : 0,
  };
}

async function report(page: Page, what: string): Promise<FrameStats> {
  const stats = summarise(await page.evaluate(() => window.__stopFrames?.() ?? []));
  const ms = (value: number) => `${value.toFixed(1)} ms`;
  console.log(
    `timeline @ ${ENTRIES} moments — ${what}: ${stats.frames} frames, median ${ms(stats.p50)}, ` +
      `p90 ${ms(stats.p90)}, worst ${ms(stats.worst)}, ${stats.fps.toFixed(1)} fps, ` +
      `${stats.dropped} missed (${percent(stats.droppedShare)}) ` +
      `(budgets: p90 under ${FRAME_BUDGET_MS} ms, no frame over ${MAX_HITCH_MS} ms)`,
  );
  await test.info().attach(`frame-rate-${what.replaceAll(/\W+/g, "-")}`, {
    body: JSON.stringify({ what, entries: ENTRIES, ...stats }, null, 2),
    contentType: "application/json",
  });
  return stats;
}

async function measureIdle(page: Page): Promise<FrameStats> {
  await startRecording(page);
  await page.waitForTimeout(IDLE_SAMPLE_MS);
  const idle = summarise(await page.evaluate(() => window.__stopFrames?.() ?? []));
  console.log(
    `timeline @ ${ENTRIES} moments — idle: ${idle.frames} frames, ` +
      `${idle.dropped} missed (${percent(idle.droppedShare)}), ${idle.fps.toFixed(1)} fps`,
  );
  return idle;
}

function expectSmooth(stats: FrameStats, idle: FrameStats, what: string): void {
  const machine = `This machine missed ${percent(idle.droppedShare)} of its frames with the timeline sitting still.`;
  expect(stats.frames, `too few frames to judge ${what}`).toBeGreaterThanOrEqual(MIN_FRAMES);
  expect(
    stats.p90,
    `${what}: p90 frame took ${stats.p90.toFixed(1)} ms, over the ${FRAME_BUDGET_MS} ms budget. ` +
      `${machine} Fix the renderer rather than the budget.`,
  ).toBeLessThanOrEqual(FRAME_BUDGET_MS);
  expect(
    stats.worst,
    `${what}: one frame took ${stats.worst.toFixed(1)} ms, over the ${MAX_HITCH_MS} ms limit. ${machine}`,
  ).toBeLessThanOrEqual(MAX_HITCH_MS);
}

async function openBench(page: Page) {
  await page.goto(`/timeline-bench?entries=${ENTRIES}`);
  await expect(page.locator(`[data-bench-entries="${ENTRIES}"]`)).toBeVisible();
  const tracks = page.getByRole("application", { name: "Timeline tracks" });
  await expect(tracks).toBeVisible();
  return tracks;
}

// Only against the server this config starts: a deployment doesn't serve the bench.
test.describe("timeline frame rate", () => {
  // One at a time, so the tests don't measure each other.
  test.describe.configure({ mode: "serial" });
  test.skip(Boolean(process.env.E2E_BASE_URL), "the bench is not served by a deployment");
  test.skip(({ browserName }) => browserName !== "chromium", "measured on one engine only");

  test("stays smooth while stepping through 5,000 moments with the keyboard", async ({ page }) => {
    const tracks = await openBench(page);
    await tracks.focus();
    // Minutes: every step re-centres the tracks, animated, on the moment the cursor lands on.
    await page.keyboard.press("+");
    await page.keyboard.press("+");
    const idle = await measureIdle(page);

    await startRecording(page);
    for (let step = 0; step < 40; step += 1) {
      await page.keyboard.press(step % 8 === 7 ? "Shift+ArrowRight" : "ArrowRight");
    }
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    for (let step = 0; step < 20; step += 1) await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(200);
    expectSmooth(await report(page, "step"), idle, "stepping");
  });

  test("stays smooth while zooming 5,000 moments", async ({ page }) => {
    const tracks = await openBench(page);
    await tracks.focus();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    const idle = await measureIdle(page);

    await startRecording(page);
    for (let round = 0; round < 4; round += 1) {
      for (const key of ["+", "+", "+", "-", "-", "-"]) {
        await page.keyboard.press(key);
        // Let each zoom's animation run, so its frames are counted.
        await page.waitForTimeout(60);
      }
    }
    expectSmooth(await report(page, "zoom"), idle, "zooming");
  });

  test("stays smooth while brushing a range across 5,000 moments", async ({ page }) => {
    await openBench(page);
    const idle = await measureIdle(page);
    const strip = page.locator("canvas").nth(1);
    const box = (await strip.boundingBox())!;
    const y = box.y + box.height / 2;
    const left = box.x + box.width * 0.3;

    await page.mouse.move(left, y);
    await page.mouse.down();
    await startRecording(page);
    for (let step = 1; step <= 60; step += 1) {
      await page.mouse.move(left + step * ((box.width * 0.4) / 60), y);
    }
    await page.mouse.up();
    await page.waitForTimeout(200);
    const stats = await report(page, "brush");
    await expect(page.getByRole("button", { name: "Show the whole case" })).toBeVisible();
    expectSmooth(stats, idle, "brushing");
  });
});
