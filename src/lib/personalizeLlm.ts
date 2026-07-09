// The only module in this app that statically imports the Vercel AI SDK
// (`ai`, `@ai-sdk/google`, `zod`). personalize.ts loads it with a dynamic
// import() on the key-present path only, so users without a Gemini API key
// never pay for this code in the main bundle.

import { generateText, Output } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import type { FeedItem } from "./types";
import type { LlmRankFn } from "./personalize";
import { toPlainText, truncate } from "./text";

// Free-tier-eligible, fast Gemini model. Pinned here so it's a one-line
// change if Google's naming shifts.
const GEMINI_RANK_MODEL = "gemini-2.5-flash-lite";

const MAX_SNIPPET_CHARS = 400;
const MAX_ITEMS = 40;

export interface CompactItem {
  id: string;
  title: string;
  sourceTitle: string;
  publishedAt: string | null; // ISO-8601, or null if unparsed (publishedAt === 0)
  snippet: string;
}

// Builds a small, model-friendly summary of each item. Caps at maxItems (by
// recency) to keep prompt size and cost bounded — the feed is meant to be
// tens of items, not thousands.
export function compactItems(
  items: FeedItem[],
  maxSnippetChars: number = MAX_SNIPPET_CHARS,
  maxItems: number = MAX_ITEMS
): CompactItem[] {
  const capped = [...items]
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, maxItems);

  return capped.map((item) => ({
    id: item.id,
    title: item.title,
    sourceTitle: item.sourceTitle,
    publishedAt: item.publishedAt ? new Date(item.publishedAt).toISOString() : null,
    snippet: truncate(toPlainText(item.content), maxSnippetChars),
  }));
}

const RankedFeedSchema = z.object({
  ranking: z.array(
    z.object({
      id: z.string(),
      score: z.number().min(0).max(1).optional(),
      reason: z.string().max(200).optional(),
    })
  ),
});

export const defaultLlmRank: LlmRankFn = async ({ items, topics, apiKey, signal }) => {
  const google = createGoogleGenerativeAI({ apiKey });
  const compact = compactItems(items);

  const { output } = await generateText({
    model: google(GEMINI_RANK_MODEL),
    output: Output.object({ schema: RankedFeedSchema }),
    instructions: `You rank a news feed for a reader, based on their stated interests.
Prefer items that match the interests; use title and snippet to judge relevance.
Return every provided item id exactly once, best match first. Keep reasons short (under 15 words).`,
    prompt: JSON.stringify({ topics, items: compact }),
    abortSignal: signal,
    timeout: 100_000,
  });

  return { order: output?.ranking ?? [] };
};
