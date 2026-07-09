# Vibe Feed

[![CI](https://github.com/unimatch-hiring/vibe-feed/actions/workflows/ci.yml/badge.svg)](https://github.com/unimatch-hiring/vibe-feed/actions/workflows/ci.yml)

## About

A tiny **client-side** news/recommendation feed. RSS sources are fetched in the
browser and rendered as a list of cards (title + full text + an LLM summary).
There is **no backend** — everything runs in the browser.

This started as a minimal scaffold: it runs out of the box, and the LLM
summarizer layer uses a mock summarizer by default. Personalization
(`src/lib/personalize.ts`) is now real: a keyword heuristic always works
offline, and reordering by an actual Gemini call is available if you add a
free-tier API key (see below).

## Before the interview

- Pick the **AI coding agent / harness you're fastest in** (Claude Code, Cursor,
  Codex, …) and have it set up and working. During the session you may use **any
  tools available to you** — MCP, plugins, sub-agents, whatever you normally use.
- Clone this repo and make sure it **runs locally** (see _Run it_ below) — so we
  don't spend interview time on setup.
- That's it. This repo is just the **scaffold** — the concrete task will be given
  at the start of the interview. No need to build anything in advance.

## Run it

```bash
npm ci      # or: npm install
npm run dev # → http://localhost:5173
```

You should see a working feed within seconds: a local mock feed (served by the
dev server, works offline) plus two CORS-friendly network sources. If the
network sources are down, the local mock alone keeps the feed alive.

Stack: Vite + React + TypeScript.

## Personalization

Add topic tags in the UI and the feed reorders by keyword match — no setup
needed. For LLM-based reranking, add a Gemini API key:

1. Get a free-tier key at [Google AI Studio](https://aistudio.google.com/apikey).
2. In AI Studio, restrict the key to the **Generative Language API**, and to
   an HTTP referrer for this site if that option is available to you.
3. Paste it into the "Add Gemini API key" panel in the app.

The key is stored **only in `localStorage`** and sent directly from your
browser to Google — there's no backend to hide it behind. Any script on this
origin (including an XSS) can read it, so treat it as a disposable free-tier
demo key, not a production secret. Clearing the key (or leaving it unset)
falls back to the keyword heuristic; the app never blanks the feed because
ranking is in flight or failed. See
[`docs/design-personalize-ai-sdk.md`](docs/design-personalize-ai-sdk.md) for
the full design.

## Tests

```bash
npm test
```

**Unit tests** (Vitest) cover the pure helpers — the mock summarizer and
`personalize`'s chronological/heuristic/remap logic (the LLM call itself is
tested via dependency injection, not a live network call). They're a smoke
check, not full coverage; extend them as you build. CI runs build + tests on
every push.

## Files

| File | What it is |
|------|------------|
| [`src/lib/feeds.ts`](src/lib/feeds.ts) | RSS sources. Heterogeneous on purpose (formats, CORS). |
| [`src/lib/rss.ts`](src/lib/rss.ts) | Fetch + parse RSS in the browser. Naive — `Promise.all`, RSS-2.0-only parser. |
| [`src/lib/personalize.ts`](src/lib/personalize.ts) | Interest model + ranking: chronological cold start, keyword heuristic, optional LLM rerank. |
| [`src/lib/personalizeLlm.ts`](src/lib/personalizeLlm.ts) | The only module that statically imports the Vercel AI SDK; dynamically imported so key-less users skip the bundle cost. |
| [`src/lib/apiKey.ts`](src/lib/apiKey.ts) | Read/write/clear/mask the Gemini API key in `localStorage`. |
| [`src/lib/summarizer.ts`](src/lib/summarizer.ts) | LLM layer behind a narrow `summarize()` interface. Mock default; WebLLM optional. |
| [`src/lib/text.ts`](src/lib/text.ts) | Shared HTML-stripping / truncation helpers. |
| [`src/lib/types.ts`](src/lib/types.ts) | Normalized `FeedItem` (title, full `content`, …). |
| [`src/App.tsx`](src/App.tsx) | UI: cards (title + full text + summary), interests editor, API key settings. |
| [`public/mock-feed.xml`](public/mock-feed.xml) | Local feed with full article text (`content:encoded`); works offline. |

Change anything — it's a starting point, not a reference.
