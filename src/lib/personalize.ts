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

// Stub: ignores interests, returns items as-is.
export function personalize(
  items: FeedItem[],
  interests: UserInterests
): FeedItem[] {
  void interests;
  return items;
}
