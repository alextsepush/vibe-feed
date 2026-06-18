import { describe, it, expect } from "vitest";
import { mockSummarizer } from "./summarizer";

describe("mockSummarizer", () => {
  it("returns the first sentence of the text", async () => {
    const out = await mockSummarizer.summarize("First sentence. Second one.");
    expect(out).toBe("First sentence.");
  });

  it("strips HTML tags", async () => {
    const out = await mockSummarizer.summarize("<p>Hello <b>world</b>.</p> Next.");
    expect(out).toBe("Hello world.");
  });

  it("falls back to a placeholder for empty input", async () => {
    expect(await mockSummarizer.summarize("")).toBe("(no summary)");
  });
});
