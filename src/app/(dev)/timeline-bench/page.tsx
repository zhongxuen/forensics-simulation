import type { Metadata } from "next";
import { requireDevPage } from "../dev-only";
import { TimelineBench } from "./timeline-bench";

export const metadata: Metadata = {
  title: "Timeline bench – Candlewright: Incident Room",
  robots: { index: false, follow: false },
};

/** Never prerendered: the gate in requireDevPage has to run per request, not once at build time. */
export const dynamic = "force-dynamic";

const number = (value: string | string[] | undefined, fallback: number): number => {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 20_000) : fallback;
};

/**
 * The Timeline view with thousands of made-up moments on it, for measuring how it draws at a size
 * no case reaches: `/timeline-bench?entries=5000`. A developer tool, gated like the styleguide.
 */
export default async function TimelineBenchPage({ searchParams }: PageProps<"/timeline-bench">) {
  requireDevPage();
  const query = await searchParams;
  return <TimelineBench entries={number(query.entries, 5000)} />;
}
