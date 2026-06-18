# Vibe Feed

[![CI](https://github.com/unimatch-hiring/vibe-feed/actions/workflows/ci.yml/badge.svg)](https://github.com/unimatch-hiring/vibe-feed/actions/workflows/ci.yml)

## About

A tiny **client-side** news/recommendation feed. RSS sources are fetched in the
browser and rendered as a list of cards (title + full text + an LLM summary).
There is **no backend** — everything runs in the browser.

This is a minimal **starting scaffold**: it runs out of the box, the feed is a
chronological list of every source, ranking/dedup is a stub, and the LLM layer
uses a mock summarizer by default.

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

## Tests

```bash
npm test
```

A small set of **unit tests** (Vitest) covering the pure helpers — the mock
summarizer and the `personalize` stub. They're a smoke check, not full coverage;
extend them as you build. CI runs build + tests on every push.

## Files

| File | What it is |
|------|------------|
| [`src/lib/feeds.ts`](src/lib/feeds.ts) | RSS sources. Heterogeneous on purpose (formats, CORS). |
| [`src/lib/rss.ts`](src/lib/rss.ts) | Fetch + parse RSS in the browser. Naive — `Promise.all`, RSS-2.0-only parser. |
| [`src/lib/personalize.ts`](src/lib/personalize.ts) | Interest model + ranking. Currently a stub that returns the feed unchanged. |
| [`src/lib/summarizer.ts`](src/lib/summarizer.ts) | LLM layer behind a narrow `summarize()` interface. Mock default; WebLLM optional. |
| [`src/lib/types.ts`](src/lib/types.ts) | Normalized `FeedItem` (title, full `content`, …). |
| [`src/App.tsx`](src/App.tsx) | UI: cards (title + full text + summary) + an interests placeholder. |
| [`public/mock-feed.xml`](public/mock-feed.xml) | Local feed with full article text (`content:encoded`); works offline. |

Change anything — it's a starting point, not a reference.
