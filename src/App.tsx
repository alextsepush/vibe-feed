import { useEffect, useMemo, useState } from "react";
import { fetchAllFeeds } from "./lib/rss";
import { personalize, EMPTY_INTERESTS, type UserInterests } from "./lib/personalize";
import { mockSummarizer, isWebGPUAvailable, getMemoryInfo, type Summarizer } from "./lib/summarizer";
import type { FeedItem } from "./lib/types";

// Minimal UI. Each card shows title + full text + an LLM summary (mockSummarizer
// by default). The interests panel below is a placeholder — personalize()
// currently ignores it and the feed is shown unchanged.

// Strip HTML to plain text for display/summarization.
function toPlainText(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function Card({ item, summarizer }: { item: FeedItem; summarizer: Summarizer }) {
  const fullText = useMemo(() => toPlainText(item.content), [item.content]);
  const [summary, setSummary] = useState<string>("…");

  useEffect(() => {
    let alive = true;
    summarizer.summarize(fullText).then((s) => {
      if (alive) setSummary(s);
    });
    return () => {
      alive = false;
    };
  }, [fullText, summarizer]);

  return (
    <li className="card">
      <a className="card__title" href={item.link} target="_blank" rel="noreferrer">
        {item.title}
      </a>
      <div className="card__meta">{item.sourceTitle}</div>

      <div className="card__summary">
        <span className="card__summary-label">Summary</span>
        {summary}
      </div>

      <details className="card__full">
        <summary>Full text</summary>
        <p>{fullText}</p>
      </details>
    </li>
  );
}

export function App() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interest model lives in memory here. Persistence (localStorage / IndexedDB /
  // DuckDB-WASM / …) is your call; nothing forces a choice.
  const [interests] = useState<UserInterests>(EMPTY_INTERESTS);

  useEffect(() => {
    fetchAllFeeds()
      .then(setItems)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  // personalize() is a stub — returns items unchanged for now.
  const feed = useMemo(() => personalize(items, interests), [items, interests]);

  return (
    <main className="app">
      <header className="app__header">
        <h1>Vibe Feed</h1>
        <span className="app__hint">
          WebGPU: {isWebGPUAvailable() ? "available" : "not available (mock LLM)"}
          {(() => {
            const { deviceMemoryGb, usedJsHeapMb } = getMemoryInfo();
            const parts: string[] = [];
            if (deviceMemoryGb !== undefined) parts.push(`~${deviceMemoryGb} GB RAM`);
            if (usedJsHeapMb !== undefined) parts.push(`${usedJsHeapMb} MB used`);
            return parts.length ? ` · ${parts.join(" · ")}` : "";
          })()}
        </span>
      </header>

      {/* Interests panel — placeholder. This is where the user says what they
          want to see. Design it: free text? tags? likes? */}
      <section className="interests">
        <span className="interests__label">My interests:</span>
        <span className="interests__value">
          {interests.topics.length ? interests.topics.join(", ") : "(none yet — cold start)"}
        </span>
      </section>

      {loading && <p className="app__state">Loading feeds…</p>}
      {error && <p className="app__state app__state--error">{error}</p>}

      <ul className="feed">
        {feed.map((item) => (
          <Card key={item.id} item={item} summarizer={mockSummarizer} />
        ))}
      </ul>
    </main>
  );
}
