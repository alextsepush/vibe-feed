// Shared text helpers for HTML feed content (used by the UI, the heuristic
// ranker, and the LLM compact-item builder).

// Strip HTML tags to plain text, collapsing whitespace.
export function toPlainText(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// Truncate to at most maxChars, without cutting a word in half.
export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}
