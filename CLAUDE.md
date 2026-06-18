# Vibe Feed — project context for AI coding agents

A tiny **client-side** news/recommendation feed. RSS sources are fetched in the
browser and rendered as cards (title + full text + an LLM summary). **No backend**
— everything runs in the browser.

This is a minimal scaffold: the feed is a chronological list of every source,
ranking/dedup is a stub, and the LLM layer uses a mock summarizer by default.

## Stack & commands

- Vite + React + TypeScript.
- `npm ci` — install. `npm run dev` → http://localhost:5173. `npm run build` → `dist/`.
- Type-check is part of the build (`tsc -b`).

## Layout

- `src/lib/feeds.ts` — RSS sources (heterogeneous on purpose: formats, CORS).
- `src/lib/rss.ts` — fetch + parse RSS in the browser. Naive (`Promise.all`, RSS-2.0-only).
- `src/lib/personalize.ts` — interest model + ranking. Currently a stub returning the feed unchanged.
- `src/lib/summarizer.ts` — LLM layer behind a narrow `summarize()` interface. Mock default; WebLLM optional.
- `src/lib/types.ts` — normalized `FeedItem` (title, full `content`, …).
- `src/App.tsx` — UI: cards (title + full text + summary) + an interests placeholder.
- `public/mock-feed.xml` — local feed (full text via `content:encoded`); works offline.

## Conventions

- Keep it minimal and dependency-light. Match the existing code style.
- The mock summarizer is the default and always works; don't make the app depend
  on a real model (WebGPU isn't available everywhere).
- It's a starting point, not a reference — change anything.
