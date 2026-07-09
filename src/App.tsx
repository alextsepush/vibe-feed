import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { fetchAllFeeds } from "./lib/rss";
import { personalize, EMPTY_INTERESTS, type UserInterests } from "./lib/personalize";
import { mockSummarizer, isWebGPUAvailable, getMemoryInfo, type Summarizer } from "./lib/summarizer";
import type { FeedItem } from "./lib/types";

// Minimal UI. Each card shows title + full text + an LLM summary (mockSummarizer
// by default). Interests are free-form tags (persisted); personalize() currently
// ignores them and the feed is shown unchanged.

// Strip HTML to plain text for display/summarization.
function toPlainText(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

const INTERESTS_KEY = "vibe-feed:interests";

function readInterests(): UserInterests {
  try {
    const raw = localStorage.getItem(INTERESTS_KEY);
    if (!raw) return EMPTY_INTERESTS;
    const data = JSON.parse(raw) as unknown;
    if (
      data &&
      typeof data === "object" &&
      Array.isArray((data as UserInterests).topics) &&
      (data as UserInterests).topics.every((t) => typeof t === "string")
    ) {
      return { topics: (data as UserInterests).topics };
    }
  } catch {
    // corrupt JSON, private mode, etc.
  }
  return EMPTY_INTERESTS;
}

function writeInterests(interests: UserInterests): void {
  try {
    localStorage.setItem(INTERESTS_KEY, JSON.stringify(interests));
  } catch {
    // quota exceeded / private mode
  }
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

/** Free-form interest tags: type anything, Enter/comma to add, × to remove. */
function InterestsEditor({
  interests,
  onChange,
}: {
  interests: UserInterests;
  onChange: (next: UserInterests) => void;
}) {
  const [draft, setDraft] = useState("");

  function addTopic(raw: string) {
    const topic = raw.trim();
    if (!topic) return;
    const exists = interests.topics.some(
      (t) => t.toLowerCase() === topic.toLowerCase()
    );
    if (exists) {
      setDraft("");
      return;
    }
    onChange({ topics: [...interests.topics, topic] });
    setDraft("");
  }

  function removeTopic(topic: string) {
    onChange({ topics: interests.topics.filter((t) => t !== topic) });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTopic(draft);
    } else if (e.key === "Backspace" && draft === "" && interests.topics.length) {
      removeTopic(interests.topics[interests.topics.length - 1]);
    }
  }

  return (
    <section className="interests">
      <span className="interests__label">My interests:</span>
      <div className="interests__tags">
        {interests.topics.map((topic) => (
          <span key={topic} className="interests__tag">
            {topic}
            <button
              type="button"
              className="interests__tag-remove"
              aria-label={`Remove ${topic}`}
              onClick={() => removeTopic(topic)}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="interests__input"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => addTopic(draft)}
          placeholder={
            interests.topics.length
              ? "Add a topic…"
              : "e.g. AI, design, startups…"
          }
          aria-label="Add interest"
        />
      </div>
      <p className="interests__hint">Free-form tags — Enter or comma to add</p>
    </section>
  );
}

export function App() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interest model, restored from localStorage and written back on change.
  const [interests, setInterests] = useState<UserInterests>(readInterests);

  useEffect(() => {
    writeInterests(interests);
  }, [interests]);

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

      <InterestsEditor interests={interests} onChange={setInterests} />

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
