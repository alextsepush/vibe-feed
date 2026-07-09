// Personalization layer: takes the raw aggregated feed and a model of what
// the user is interested in, and returns the feed to actually show.
//
// Hybrid ranking, in order of preference:
//   1. Cold start (no usable topics)      -> chronological, no network
//   2. No API key / forced                -> keyword heuristic, no network
//   3. API key present                    -> single-shot LLM rerank (Gemini,
//                                            via the Vercel AI SDK), falling
//                                            back to the heuristic on any
//                                            failure.
//
// `personalize()` is async and (per K10 in docs/design-personalize-ai-sdk.md)
// resolves for every expected failure mode instead of rejecting — callers
// never need to guard against a blank feed because ranking failed.
//
// This module never statically imports the AI SDK: the LLM path is loaded
// with a dynamic import() (see personalizeLlm.ts) so users without an API
// key don't pay for that code in the main bundle.

import type { FeedItem } from "./types";
import { toPlainText } from "./text";

export interface UserInterests {
  topics: string[]; // empty by default (cold start)
}

export const EMPTY_INTERESTS: UserInterests = { topics: [] };

export type PersonalizeMode = "chrono" | "heuristic" | "llm";

export interface RankMeta {
  score?: number;
  reason?: string;
}

export interface RankOrderEntry {
  id: string;
  score?: number;
  reason?: string;
}

// Explicit fn type (rather than `typeof defaultLlmRank`) so this module never
// needs a static import of the LLM implementation, and tests can inject a
// fake without touching the network or the AI SDK.
export type LlmRankFn = (args: {
  items: FeedItem[];
  topics: string[];
  apiKey: string;
  signal?: AbortSignal;
}) => Promise<{ order: RankOrderEntry[] }>;

export interface PersonalizeOptions {
  // Gemini API key from user settings. Absent/blank -> heuristic.
  apiKey?: string;
  // Force heuristic even if a key is present (tests / debug / user opt-out).
  forceHeuristic?: boolean;
  // Forwarded to the LLM call; aborting cancels the in-flight request.
  signal?: AbortSignal;
  // Inject an LLM implementation, bypassing the dynamic import (tests).
  llmRank?: LlmRankFn;
}

export interface PersonalizeResult {
  items: FeedItem[];
  mode: PersonalizeMode;
  metaById: Map<string, RankMeta>;
  // Non-fatal, e.g. "LLM failed; used keyword ranking (…)"
  warning?: string;
}

// Topics that actually participate in ranking: trimmed, non-empty, and long
// enough to avoid false positives from short free-form tags (e.g. "a", "to").
export function effectiveTopics(raw: string[]): string[] {
  return raw.map((t) => t.trim()).filter((t) => t.length >= 2);
}

// Newest first; items with publishedAt === 0 (unparsed date) sort last.
// Ties (including all-zero dates) keep original arrival order.
export function chronological(items: FeedItem[]): FeedItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      if (a.item.publishedAt === 0 && b.item.publishedAt !== 0) return 1;
      if (b.item.publishedAt === 0 && a.item.publishedAt !== 0) return -1;
      if (a.item.publishedAt !== b.item.publishedAt) {
        return b.item.publishedAt - a.item.publishedAt;
      }
      return a.index - b.index;
    })
    .map((x) => x.item);
}

// Offline, deterministic scoring: title match worth more than content match.
// Items that don't match any topic are kept (not filtered), ranked last.
export function heuristicRank(
  items: FeedItem[],
  topics: string[]
): PersonalizeResult {
  const needles = topics.map((t) => t.toLowerCase());

  const scored = items.map((item, index) => {
    const title = item.title.toLowerCase();
    const content = toPlainText(item.content).toLowerCase();
    const matched: string[] = [];
    let score = 0;
    for (let i = 0; i < needles.length; i++) {
      const needle = needles[i];
      const inTitle = title.includes(needle);
      const inContent = !inTitle && content.includes(needle);
      if (inTitle) {
        score += 3;
        matched.push(topics[i]);
      } else if (inContent) {
        score += 1;
        matched.push(topics[i]);
      }
    }
    return { item, index, score, matched };
  });

  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.item.publishedAt !== b.item.publishedAt) {
      return b.item.publishedAt - a.item.publishedAt;
    }
    return a.index - b.index;
  });

  const metaById = new Map<string, RankMeta>();
  for (const { item, score, matched } of scored) {
    if (score > 0) {
      metaById.set(item.id, { score, reason: `matched: ${matched.join(", ")}` });
    }
  }

  return { items: scored.map((x) => x.item), mode: "heuristic", metaById };
}

// Applies a model-provided order to `items`, safely: unknown ids are
// dropped, missing ids are appended (in their original relative order), and
// duplicate ids keep only the first occurrence. Result length always equals
// items.length.
export function remapRanking(
  items: FeedItem[],
  order: RankOrderEntry[]
): PersonalizeResult {
  const byId = new Map(items.map((item) => [item.id, item]));
  const used = new Set<string>();
  const metaById = new Map<string, RankMeta>();
  const ranked: FeedItem[] = [];

  for (const entry of order) {
    if (used.has(entry.id)) continue;
    const item = byId.get(entry.id);
    if (!item) continue;
    used.add(entry.id);
    ranked.push(item);
    if (entry.score !== undefined || entry.reason !== undefined) {
      metaById.set(entry.id, { score: entry.score, reason: entry.reason });
    }
  }

  for (const item of items) {
    if (!used.has(item.id)) {
      ranked.push(item);
    }
  }

  return { items: ranked, mode: "llm", metaById };
}

function summarizeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

/**
 * Ranks the feed for the reader's interests. Always resolves for expected
 * failure modes (missing key, network error, malformed LLM output, timeout,
 * abort) by falling back to the keyword heuristic — see K10 in
 * docs/design-personalize-ai-sdk.md. result.items.length === items.length.
 */
export async function personalize(
  items: FeedItem[],
  interests: UserInterests,
  options: PersonalizeOptions = {}
): Promise<PersonalizeResult> {
  if (items.length === 0) {
    return { items: [], mode: "chrono", metaById: new Map() };
  }

  const topics = effectiveTopics(interests.topics);
  if (topics.length === 0) {
    return { items: chronological(items), mode: "chrono", metaById: new Map() };
  }

  const apiKey = options.apiKey?.trim();
  if (!apiKey || options.forceHeuristic) {
    return heuristicRank(items, topics);
  }

  try {
    const llmRank =
      options.llmRank ?? (await import("./personalizeLlm")).defaultLlmRank;
    const { order } = await llmRank({
      items,
      topics,
      apiKey,
      signal: options.signal,
    });
    if (!order?.length) {
      return {
        ...heuristicRank(items, topics),
        warning: "LLM returned no ranking; used keyword ranking",
      };
    }
    return { ...remapRanking(items, order), mode: "llm" };
  } catch (e) {
    if (options.signal?.aborted) {
      return { ...heuristicRank(items, topics), warning: "Ranking cancelled" };
    }
    return {
      ...heuristicRank(items, topics),
      warning: `LLM failed; used keyword ranking (${summarizeError(e)})`,
    };
  }
}
