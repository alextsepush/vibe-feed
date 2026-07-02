// Personalization layer: takes the raw aggregated feed and a model of what the
// user is interested in, and returns the feed to actually show.
//
// Currently a stub — it ignores the interests and returns items unchanged
// (the feed is just every article in arrival order). The interest model and
// the ranking/filtering are deliberately left minimal.

import type { FeedItem } from "./types";

// A minimal interest model. Shape it however the design needs.
export interface UserInterests {
  topics: string[]; // empty by default (cold start)
}

export const EMPTY_INTERESTS: UserInterests = { topics: [] };

/**
 * Returns the feed as-is. This is a stub — your job is to make it personalize.
 *
 * Going further (optional): a hardcoded sort is one way. Another is to treat this
 * as an *agent* — hand it tools (e.g. scoreItem, rerank) and let it decide how to
 * order the feed for the reader's interests. Any TS agent SDK works — the Vercel
 * AI SDK (https://ai-sdk.dev), the OpenAI Agents SDK, or the Claude Agent SDK all
 * run in the browser; pick whichever you like. Gemini has a free tier
 * (https://aistudio.google.com). There's no single right answer — we care how you
 * reason about it.
 */
export function personalize(
  items: FeedItem[],
  interests: UserInterests
): FeedItem[] {
  void interests;
  return items;
}
