import { describe, expect, it } from "vitest";
import { placeCard } from "@/components/ui/coach-mark";

/**
 * Where the guided tour's card goes (phase 11: the end-to-end first-five-minutes test found the
 * first card hanging off the bottom of a 1280x720 laptop screen, with Next out of reach). Every
 * placement must keep the whole card on screen.
 */

const EDGE = 16;
const onScreen = (top: number, height: number, viewport: number) =>
  top >= EDGE && top + height <= viewport - EDGE;

describe("placeCard", () => {
  it("puts the card below the target when it fits there", () => {
    expect(
      placeCard({
        placement: "bottom",
        spotTop: 100,
        spotBottom: 160,
        cardHeight: 250,
        viewportHeight: 800,
      }),
    ).toEqual({ side: "bottom", top: 172, clamped: false });
  });

  it("flips it above the target when the bottom of the screen is too close (the 720px laptop)", () => {
    const placed = placeCard({
      placement: "bottom",
      spotTop: 424,
      spotBottom: 524,
      cardHeight: 250,
      viewportHeight: 720,
    });
    expect(placed.side).toBe("top");
    expect(placed.clamped).toBe(false);
    expect(onScreen(placed.top, 250, 720)).toBe(true);
    expect(placed.top + 250).toBeLessThanOrEqual(424);
  });

  it("keeps it on screen, over the target, when neither side has room", () => {
    const placed = placeCard({
      placement: "bottom",
      spotTop: 150,
      spotBottom: 450,
      cardHeight: 300,
      viewportHeight: 600,
    });
    expect(placed.clamped).toBe(true);
    expect(onScreen(placed.top, 300, 600)).toBe(true);
  });

  it("honours a card that prefers the top, and flips it down when the top is too close", () => {
    expect(
      placeCard({
        placement: "top",
        spotTop: 500,
        spotBottom: 560,
        cardHeight: 200,
        viewportHeight: 800,
      }).side,
    ).toBe("top");
    const flipped = placeCard({
      placement: "top",
      spotTop: 60,
      spotBottom: 120,
      cardHeight: 200,
      viewportHeight: 800,
    });
    expect(flipped.side).toBe("bottom");
    expect(onScreen(flipped.top, 200, 800)).toBe(true);
  });

  it("never places any card off screen, whatever the sizes", () => {
    for (const viewportHeight of [480, 600, 720, 900]) {
      for (let spotTop = 0; spotTop < viewportHeight; spotTop += 37) {
        for (const cardHeight of [120, 250, 400]) {
          for (const placement of ["top", "bottom"] as const) {
            const { top } = placeCard({
              placement,
              spotTop,
              spotBottom: spotTop + 60,
              cardHeight,
              viewportHeight,
            });
            expect(
              onScreen(top, cardHeight, viewportHeight),
              JSON.stringify({ viewportHeight, spotTop, cardHeight, placement }),
            ).toBe(true);
          }
        }
      }
    }
  });
});
