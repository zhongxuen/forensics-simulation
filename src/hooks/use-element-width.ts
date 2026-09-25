import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * How wide `ref`'s element is, in CSS pixels, kept current as it resizes. For a component whose
 * layout depends on the room its container gives it rather than the screen: a workspace pane is
 * half the screen beside the terminal and all of it with Focus pane on.
 *
 * Undefined until the element has been measured with a width. A hidden element (a tab panel
 * that isn't showing) measures 0, so the last real width is kept while it's hidden, and a
 * component in an environment without layout (jsdom) never gets one.
 */
export function useElementWidth(ref: RefObject<Element | null>): number | undefined {
  const [width, setWidth] = useState<number>();

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = (value: number) => {
      if (value > 0) setWidth(Math.round(value));
    };
    measure(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) measure(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}
