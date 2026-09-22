import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ErrorState } from "@/components/shell/error-state";

/**
 * The error screen every route falls back to (phase 11: "error and empty states exist for every
 * route"). It can't be reached on purpose in the end-to-end tests, so it's checked here: calm words
 * with no blame, Try again, two ways on, and error tracking that sends the digest, never the
 * message.
 */

const vercel = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@vercel/analytics", async (original) => ({
  ...(await original<typeof import("@vercel/analytics")>()),
  track: vercel.track,
}));

/**
 * ErrorState loads `@/lib/analytics` on demand, from inside the effect that reports the error, so
 * the first error screen to render is what pulls that module — and with it @vercel/analytics and
 * the settings store — through Vitest's transform. Under `pnpm test`, with all four projects
 * competing for the cores, that first load can take longer than waitFor's one-second budget, which
 * fails the assertion below for a reason that has nothing to do with the component.
 *
 * Loading it here turns that into something the test awaits: by the time the effect asks, the
 * module registry already has it and the dynamic import resolves on a microtask.
 */
beforeAll(async () => {
  await import("@/lib/analytics");
});

describe("ErrorState", () => {
  it("says it's not the learner's fault, what it means for a case, and offers ways on", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    render(
      <ErrorState
        error={Object.assign(new Error("secret internal detail"), { digest: "abc123" })}
        retry={retry}
        area="app"
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Something went wrong on our end, not yours" }),
    ).toBeTruthy();
    expect(document.body.textContent).toContain("open it again from the case list");
    expect(document.body.textContent).not.toContain("secret internal detail");
    expect(screen.getByRole("link", { name: "Open Case 1" }).getAttribute("href")).toBe(
      "/cases/case-01",
    );
    expect(screen.getByText("abc123")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("counts the error screen with its digest only, never its message", async () => {
    render(
      <ErrorState
        error={Object.assign(new Error("learner typed: my-secret"), { digest: "d1g35t" })}
        retry={() => {}}
        area="site"
      />,
    );
    await waitFor(() =>
      expect(vercel.track).toHaveBeenCalledWith("Error shown", { area: "site", digest: "d1g35t" }),
    );
    expect(JSON.stringify(vercel.track.mock.calls)).not.toContain("my-secret");
  });
});
