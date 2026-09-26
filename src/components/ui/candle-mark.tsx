import type { SVGProps } from "react";

/**
 * Candlewright's mark: a candle and its flame, drawn in the current text colour. Decorative, so
 * it's hidden from screen readers: always put it beside the name or inside something that has one.
 */
export function CandleMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {/* The flame, with a solid core. */}
      <path
        d="M12 2.5c2.2 2.4 3.3 4.2 3.3 5.9a3.3 3.3 0 0 1-6.6 0c0-1.7 1.1-3.5 3.3-5.9Z"
        fill="currentColor"
        fillOpacity={0.2}
      />
      <path
        d="M12 6.4c.8 1 1.3 1.7 1.3 2.4a1.3 1.3 0 0 1-2.6 0c0-.7.5-1.4 1.3-2.4Z"
        fill="currentColor"
        stroke="none"
      />
      {/* The wick and the candle. */}
      <path d="M12 11.7v1.8" />
      <rect x="8.25" y="13.5" width="7.5" height="8" rx="1.25" />
    </svg>
  );
}
