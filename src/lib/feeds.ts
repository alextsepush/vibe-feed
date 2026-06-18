// Public RSS/Atom sources for the feed.
//
// NOTE (this is part of the task, not a bug): the sources are intentionally
// heterogeneous — feeds come in different formats (RSS 2.0 and Atom), and the
// parser in rss.ts is naive and only understands RSS 2.0 <item>.
//
// The default sources all load with a plain browser fetch (local mock is
// served by the dev server; the network ones send CORS headers). Add more if
// you like.

export interface FeedSource {
  id: string;
  title: string;
  url: string;
}

export const FEEDS: FeedSource[] = [
  {
    // Local mock, served by the dev server. Works offline, no network needed —
    // so the feed is alive out of the box on any machine.
    id: "local",
    title: "Local mock feed",
    url: "/mock-feed.xml",
  },
  {
    id: "github",
    title: "The GitHub Blog",
    url: "https://github.blog/feed/",
  },
  {
    id: "devto",
    title: "DEV Community",
    url: "https://dev.to/feed",
  },
  // More sources you can add — but these do NOT serve CORS headers, so a direct
  // browser fetch fails and you'd need a CORS proxy (your call):
  //   https://news.ycombinator.com/rss        (Hacker News)
  //   https://lobste.rs/rss                    (Lobsters)
  //   https://www.theverge.com/rss/index.xml   (Atom, not RSS 2.0)
];
