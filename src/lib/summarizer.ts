// The feed's LLM layer. Any summarization / ranking goes through this narrow
// interface, so any implementation (mock / WebLLM / remote call) can hide
// behind it without touching the UI.
//
// The default is a mock summarizer — deterministic, instant, always works. A
// real in-browser model (WebLLM/WebGPU) is heavy (hundreds of MB to GB of
// weights) and isn't available on every machine, so the app must stay useful
// when WebGPU is absent.

export interface Summarizer {
  // Short summary of a single piece of text.
  summarize(text: string): Promise<string>;
}

// --- Mock: the default. Deterministic, instant, always works. ---
export const mockSummarizer: Summarizer = {
  async summarize(text: string): Promise<string> {
    const clean = text.replace(/<[^>]*>/g, "").trim();
    const firstSentence = clean.split(/(?<=[.!?])\s/)[0] ?? clean;
    return firstSentence.slice(0, 200) || "(no summary)";
  },
};

// --- WebGPU availability check. ---
export function isWebGPUAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

// --- Rough memory budget hints, to gauge whether a model would fit. ---
// Both are best-effort and Chromium-only-ish:
//   deviceMemoryGb  — approximate device RAM (navigator.deviceMemory), capped by
//                     the browser (usually 0.25–8). undefined if unsupported.
//   usedJsHeapMb    — current JS heap usage (performance.memory). undefined if
//                     unsupported (non-Chromium).
export interface MemoryInfo {
  deviceMemoryGb?: number;
  usedJsHeapMb?: number;
}

export function getMemoryInfo(): MemoryInfo {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize: number };
  };
  return {
    deviceMemoryGb: nav.deviceMemory,
    usedJsHeapMb: perf.memory
      ? Math.round(perf.memory.usedJSHeapSize / 1048576)
      : undefined,
  };
}

// --- Optional: a real in-browser LLM via WebLLM. ---
// Not implemented. The @mlc-ai/web-llm package is in optionalDependencies; wire
// it up here behind the same Summarizer interface if you want on-device LLM.
//
// export async function createWebLLMSummarizer(): Promise<Summarizer> {
//   if (!isWebGPUAvailable()) throw new Error("WebGPU is not available");
//   const webllm = await import("@mlc-ai/web-llm");
//   // ... create an engine, return { summarize }
// }
