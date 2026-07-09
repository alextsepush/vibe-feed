import { describe, it, expect, vi } from "vitest";
import {
  personalize,
  chronological,
  effectiveTopics,
  heuristicRank,
  remapRanking,
  EMPTY_INTERESTS,
} from "./personalize";
import type { FeedItem } from "./types";

const item = (overrides: Partial<FeedItem> & { id: string }): FeedItem => ({
  title: overrides.id,
  link: `https://example.com/${overrides.id}`,
  content: "",
  publishedAt: 0,
  sourceId: "s",
  sourceTitle: "S",
  ...overrides,
});

describe("effectiveTopics", () => {
  it("trims, drops empty, and drops single-char topics", () => {
    expect(effectiveTopics([" ai ", "", "a", "x", "design"])).toEqual([
      "ai",
      "design",
    ]);
  });
});

describe("chronological", () => {
  it("sorts newest first", () => {
    const a = item({ id: "a", publishedAt: 100 });
    const b = item({ id: "b", publishedAt: 300 });
    const c = item({ id: "c", publishedAt: 200 });
    expect(chronological([a, b, c]).map((i) => i.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts unparsed dates (publishedAt: 0) last, stable by original index", () => {
    const a = item({ id: "a", publishedAt: 0 });
    const b = item({ id: "b", publishedAt: 100 });
    const c = item({ id: "c", publishedAt: 0 });
    expect(chronological([a, b, c]).map((i) => i.id)).toEqual(["b", "a", "c"]);
  });
});

describe("personalize — cold start", () => {
  it("empty items resolves to empty chrono result", async () => {
    const result = await personalize([], EMPTY_INTERESTS);
    expect(result).toEqual({ items: [], mode: "chrono", metaById: new Map() });
  });

  it("empty topics -> chronological, not arrival identity", async () => {
    const a = item({ id: "a", publishedAt: 100 });
    const b = item({ id: "b", publishedAt: 300 });
    const result = await personalize([a, b], EMPTY_INTERESTS);
    expect(result.mode).toBe("chrono");
    expect(result.items.map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("only short topics (< 2 chars) -> chronological, not empty heuristic", async () => {
    const a = item({ id: "a", publishedAt: 100 });
    const b = item({ id: "b", publishedAt: 300 });
    const result = await personalize([a, b], { topics: ["a", ""] });
    expect(result.mode).toBe("chrono");
  });
});

describe("heuristicRank", () => {
  it("ranks title matches above content matches", () => {
    const a = item({ id: "a", title: "Random", content: "mentions ai briefly" });
    const b = item({ id: "b", title: "All about AI", content: "" });
    const result = heuristicRank([a, b], ["ai"]);
    expect(result.items.map((i) => i.id)).toEqual(["b", "a"]);
    expect(result.mode).toBe("heuristic");
  });

  it("keeps zero-score items in the list, ranked last", () => {
    const a = item({ id: "a", title: "AI news" });
    const b = item({ id: "b", title: "Unrelated" });
    const result = heuristicRank([a, b], ["ai"]);
    expect(result.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(result.metaById.has("b")).toBe(false);
  });

  it("ignores short tags among longer ones", () => {
    const a = item({ id: "a", title: "Design systems" });
    const b = item({ id: "b", title: "Nothing relevant" });
    const result = heuristicRank([a, b], effectiveTopics(["x", "design"]));
    expect(result.items.map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("personalize — heuristic path", () => {
  it("uses heuristic when no API key is present", async () => {
    const a = item({ id: "a", title: "Design systems" });
    const b = item({ id: "b", title: "Unrelated" });
    const result = await personalize([a, b], { topics: ["design"] });
    expect(result.mode).toBe("heuristic");
    expect(result.items.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("forceHeuristic bypasses an injected llmRank even with a key", async () => {
    const a = item({ id: "a", title: "Design systems" });
    const llmRank = vi.fn();
    const result = await personalize(
      [a],
      { topics: ["design"] },
      { apiKey: "key", forceHeuristic: true, llmRank }
    );
    expect(llmRank).not.toHaveBeenCalled();
    expect(result.mode).toBe("heuristic");
  });
});

describe("remapRanking", () => {
  it("applies the given order", () => {
    const a = item({ id: "a" });
    const b = item({ id: "b" });
    const result = remapRanking([a, b], [{ id: "b" }, { id: "a" }]);
    expect(result.items.map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("appends items the model omitted", () => {
    const a = item({ id: "a" });
    const b = item({ id: "b" });
    const result = remapRanking([a, b], [{ id: "b" }]);
    expect(result.items.map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("drops unknown ids", () => {
    const a = item({ id: "a" });
    const result = remapRanking([a], [{ id: "ghost" }, { id: "a" }]);
    expect(result.items.map((i) => i.id)).toEqual(["a"]);
  });

  it("keeps only the first occurrence of a duplicate id", () => {
    const a = item({ id: "a" });
    const b = item({ id: "b" });
    const result = remapRanking([a, b], [{ id: "a" }, { id: "a" }, { id: "b" }]);
    expect(result.items.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("result length always equals items.length", () => {
    const a = item({ id: "a" });
    const b = item({ id: "b" });
    const c = item({ id: "c" });
    const result = remapRanking([a, b, c], [{ id: "b" }, { id: "ghost" }]);
    expect(result.items).toHaveLength(3);
  });
});

describe("personalize — injected LLM path", () => {
  it("uses the LLM order on success", async () => {
    const a = item({ id: "a" });
    const b = item({ id: "b" });
    const llmRank = vi.fn().mockResolvedValue({ order: [{ id: "b" }, { id: "a" }] });
    const result = await personalize(
      [a, b],
      { topics: ["ai"] },
      { apiKey: "key", llmRank }
    );
    expect(result.mode).toBe("llm");
    expect(result.items.map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("falls back to heuristic (with warning) when llmRank throws", async () => {
    const a = item({ id: "a", title: "AI news" });
    const llmRank = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await personalize(
      [a],
      { topics: ["ai"] },
      { apiKey: "key", llmRank }
    );
    expect(result.mode).toBe("heuristic");
    expect(result.warning).toMatch(/network down/);
  });

  it("falls back to heuristic when llmRank returns an empty order", async () => {
    const a = item({ id: "a", title: "AI news" });
    const llmRank = vi.fn().mockResolvedValue({ order: [] });
    const result = await personalize(
      [a],
      { topics: ["ai"] },
      { apiKey: "key", llmRank }
    );
    expect(result.mode).toBe("heuristic");
    expect(result.warning).toBeTruthy();
  });

  it("falls back to heuristic when llmRank resolves with a nullish order", async () => {
    const a = item({ id: "a", title: "AI news" });
    const llmRank = vi.fn().mockResolvedValue({} as { order: [] });
    const result = await personalize(
      [a],
      { topics: ["ai"] },
      { apiKey: "key", llmRank }
    );
    expect(result.mode).toBe("heuristic");
    expect(result.warning).toBeTruthy();
  });

  it("never rejects, even when llmRank throws", async () => {
    const a = item({ id: "a" });
    const llmRank = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(
      personalize([a], { topics: ["ai"] }, { apiKey: "key", llmRank })
    ).resolves.toBeTruthy();
  });
});
