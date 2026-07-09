import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { fetchAllFeeds } from "./lib/rss";
import {
  personalize,
  chronological,
  EMPTY_INTERESTS,
  type UserInterests,
  type PersonalizeMode,
  type RankMeta,
} from "./lib/personalize";
import { mockSummarizer, isWebGPUAvailable, getMemoryInfo, type Summarizer } from "./lib/summarizer";
import { readApiKey, writeApiKey, clearApiKey, maskApiKey } from "./lib/apiKey";
import { toPlainText } from "./lib/text";
import type { FeedItem } from "./lib/types";

// Minimal UI. Each card shows title + full text + an LLM summary (mockSummarizer
// by default). Interests are free-form tags (persisted). personalize() reorders
// the feed: chronological cold start, keyword heuristic, or (with a Gemini API
// key) a single LLM rerank — see src/lib/personalize.ts.

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

function itemsKeyOf(list: FeedItem[]): string {
  return list.map((i) => i.id).join("\0");
}

function modeHint(mode: PersonalizeMode, hasKey: boolean): string | null {
  if (mode === "heuristic" && !hasKey) {
    return "Ranked by keyword match (add a Gemini API key for LLM ranking)";
  }
  if (mode === "llm") {
    return "Ranked by Gemini";
  }
  return null;
}

function Card({
  item,
  meta,
  summarizer,
}: {
  item: FeedItem;
  meta?: RankMeta;
  summarizer: Summarizer;
}) {
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

      {meta?.reason && <div className="card__reason">Why: {meta.reason}</div>}

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

/** Collapsible Gemini API key entry. Key lives only in localStorage. */
function ApiKeySettings({
  apiKey,
  onChange,
}: {
  apiKey: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  function save() {
    const saved = writeApiKey(draft);
    onChange(saved ? draft.trim() : "");
    setDraft("");
  }

  function clear() {
    clearApiKey();
    onChange("");
    setDraft("");
  }

  return (
    <section className="api-key">
      <button
        type="button"
        className="api-key__toggle"
        onClick={() => setOpen((v) => !v)}
      >
        {apiKey ? `Gemini key: ${maskApiKey(apiKey)}` : "Add Gemini API key (optional)"}
      </button>
      {open && (
        <div className="api-key__panel">
          <p className="api-key__hint">
            Stored only in this browser. Any script on this origin (including
            XSS) can read it. Create a key at{" "}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
              Google AI Studio
            </a>
            , restrict it to the Generative Language API (and HTTP referrer,
            when available), and treat it as a free-tier demo key — not a
            production secret.
          </p>
          <div className="api-key__row">
            <input
              className="api-key__input"
              type="password"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Paste Gemini API key…"
              aria-label="Gemini API key"
            />
            <button type="button" onClick={save} disabled={!draft.trim()}>
              Save
            </button>
            {apiKey && (
              <button type="button" onClick={clear}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function App() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interest model, restored from localStorage and written back on change.
  const [interests, setInterests] = useState<UserInterests>(readInterests);
  const [apiKey, setApiKey] = useState<string>(readApiKey);

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [rankMeta, setRankMeta] = useState<Map<string, RankMeta>>(new Map());
  const [rankingStatus, setRankingStatus] = useState<"idle" | "ranking" | "error">("idle");
  const [rankingMessage, setRankingMessage] = useState<string | null>(null);

  const prevItemsKeyRef = useRef<string>("");
  const prevInterestsKeyRef = useRef<string>("");
  const prevApiKeyRef = useRef<string>("");

  useEffect(() => {
    writeInterests(interests);
  }, [interests]);

  useEffect(() => {
    fetchAllFeeds()
      .then(setItems)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  // Async, cancellable ranking: chrono paint immediately when the item set
  // changes, keep the previous ranked order (SWR) while only interests/key
  // change, and never blank the feed while items are loaded.
  useEffect(() => {
    if (items.length === 0) {
      setFeed([]);
      setRankMeta(new Map());
      setRankingStatus("idle");
      prevItemsKeyRef.current = "";
      return;
    }

    const itemsKey = itemsKeyOf(items);
    const interestsKey = JSON.stringify(interests.topics);
    const itemsChanged = itemsKey !== prevItemsKeyRef.current;
    const interestsChanged = interestsKey !== prevInterestsKeyRef.current;
    const apiKeyChanged = apiKey !== prevApiKeyRef.current;

    if (itemsChanged) {
      setFeed(chronological(items));
      setRankMeta(new Map());
    }

    prevItemsKeyRef.current = itemsKey;
    prevInterestsKeyRef.current = interestsKey;
    prevApiKeyRef.current = apiKey;

    setRankingStatus("ranking");

    const ac = new AbortController();
    const delayMs = itemsChanged ? 0 : interestsChanged || apiKeyChanged ? 300 : 0;

    const handle = window.setTimeout(async () => {
      try {
        const result = await personalize(items, interests, {
          apiKey: apiKey || undefined,
          signal: ac.signal,
        });
        if (ac.signal.aborted) return;
        setFeed(result.items);
        setRankMeta(result.metaById);
        setRankingStatus("idle");
        setRankingMessage(result.warning ?? modeHint(result.mode, Boolean(apiKey)));
      } catch (e) {
        if (ac.signal.aborted) return;
        setFeed(chronological(items));
        setRankingStatus("error");
        setRankingMessage(String(e));
      }
    }, delayMs);

    return () => {
      ac.abort();
      clearTimeout(handle);
    };
  }, [items, interests, apiKey]);

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
      <ApiKeySettings apiKey={apiKey} onChange={setApiKey} />

      {loading && <p className="app__state">Loading feeds…</p>}
      {error && <p className="app__state app__state--error">{error}</p>}
      {rankingStatus === "ranking" && <p className="app__state">Ranking…</p>}
      {rankingMessage && rankingStatus !== "error" && (
        <p className="app__state app__state--hint">{rankingMessage}</p>
      )}
      {rankingStatus === "error" && (
        <p className="app__state app__state--error">{rankingMessage}</p>
      )}

      <ul className="feed">
        {feed.map((item) => (
          <Card key={item.id} item={item} meta={rankMeta.get(item.id)} summarizer={mockSummarizer} />
        ))}
      </ul>
    </main>
  );
}
