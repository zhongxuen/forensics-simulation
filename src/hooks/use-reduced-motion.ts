import { useCallback, useSyncExternalStore, type RefObject } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Whether decorative motion is off for `element`. Reads --motion-scale (src/styles/motion.css), so
 * the answer matches the CSS exactly: the system setting, and the nearest data-motion attribute.
 */
export function isMotionReduced(element: Element): boolean {
  return getComputedStyle(element).getPropertyValue("--motion-scale").trim() === "0";
}

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener("change", onChange);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ["data-motion"],
  });
  // Subscribing happens after the first commit, when a passed ref is attached: check again.
  onChange();
  return () => {
    media.removeEventListener("change", onChange);
    observer.disconnect();
  };
}

/**
 * True when decorative motion should be off: the learner's system asks for reduced motion, or a
 * data-motion="reduce" attribute is above `ref` (or on <html>, without a ref).
 *
 * For effects driven from JavaScript, like a typewriter. CSS animations handle reduced motion on
 * their own. Before hydration this reports false, so server HTML is never missing content only
 * reduced motion would show: effects should render their finished state until they start.
 */
export function useReducedMotion(ref?: RefObject<Element | null>): boolean {
  const getSnapshot = useCallback(
    () => isMotionReduced(ref?.current ?? document.documentElement),
    [ref],
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
