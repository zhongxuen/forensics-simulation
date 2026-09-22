import { buildSearchIndex } from "@/features/learning/server";

/**
 * The search index for the command palette and the in-mission reference drawer
 * (md-files/09-learning-center.md, prompt 09.5): every lesson, glossary word and command manual
 * page. Built once at build time and served as a static file: no code runs when it's requested,
 * and it says nothing about who asks.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(buildSearchIndex());
}
