import { describe, it, expect } from "vitest";
import { personalize, EMPTY_INTERESTS } from "./personalize";
import type { FeedItem } from "./types";

const item = (id: string): FeedItem => ({
  id,
  title: id,
  link: `https://example.com/${id}`,
  content: "",
  publishedAt: 0,
  sourceId: "s",
  sourceTitle: "S",
});

describe("personalize (stub)", () => {
  it("returns items unchanged for now", () => {
    const items = [item("a"), item("b")];
    expect(personalize(items, EMPTY_INTERESTS)).toEqual(items);
  });
});
