import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/**
 * jsdom is a browser without layout or paint, and without a few APIs the app uses. These stand-ins
 * are the smallest that behave like the real thing for what the components do with them. Nothing
 * here fakes app behaviour: a component that needs one of these still runs its real code.
 */

// <dialog>: open and close as the browser does, including the close event the dialogs listen for.
if (typeof HTMLDialogElement.prototype.showModal !== "function") {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}

// No media query matches: no reduced-motion preference, a wide screen.
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
window.ResizeObserver ??= NoopObserver as unknown as typeof ResizeObserver;
window.IntersectionObserver ??= NoopObserver as unknown as typeof IntersectionObserver;

// jsdom runs no CSS animations, so there are never any to wait for.
Element.prototype.getAnimations ??= () => [];

Element.prototype.scrollIntoView ??= () => {};

// <canvas>: jsdom has no 2D context and logs "not implemented" for asking. Components that draw
// already cope with no context (the Timeline's tracks), so say there isn't one, quietly.
HTMLCanvasElement.prototype.getContext = (() =>
  null) as typeof HTMLCanvasElement.prototype.getContext;
window.scrollTo = () => {};
Element.prototype.scrollTo ??= () => {};

// The mentor routes aren't running: any request the components make gets a network error, which
// every mentor request treats as "use the text written ahead of time". Tests that need a specific
// answer (a 429 from the rate limit, say) replace fetch themselves.
vi.stubGlobal(
  "fetch",
  vi.fn(async () => {
    throw new TypeError("fetch failed: no server in component tests");
  }),
);

afterEach(() => {
  cleanup();
  localStorage.clear();
});
