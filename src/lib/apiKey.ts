// User-supplied Gemini API key, stored locally. This is a pure client-side
// app with no backend, so there is no way to hide the key — it lives in
// localStorage and is sent directly from the browser to Google's API. Users
// should restrict the key (Generative Language API + HTTP referrer) in
// Google AI Studio and treat it as a free-tier demo key, not a secret.

export const API_KEY_STORAGE = "vibe-feed:gemini-api-key";

export function readApiKey(): string {
  try {
    return localStorage.getItem(API_KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

// Trims the key; if empty after trimming, clears storage instead of writing
// a blank value. Returns whether a non-empty key was saved.
export function writeApiKey(key: string): boolean {
  const trimmed = key.trim();
  try {
    if (!trimmed) {
      localStorage.removeItem(API_KEY_STORAGE);
      return false;
    }
    localStorage.setItem(API_KEY_STORAGE, trimmed);
    return true;
  } catch {
    return false;
  }
}

export function clearApiKey(): void {
  try {
    localStorage.removeItem(API_KEY_STORAGE);
  } catch {
    // ignore
  }
}

// For display only: mask everything but the last 4 characters.
export function maskApiKey(key: string): string {
  if (key.length < 4) return "••••";
  return `••••${key.slice(-4)}`;
}
