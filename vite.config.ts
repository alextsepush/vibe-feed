import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Minimal config. Dev server on :5173.
// base is set for GitHub Pages (served under /vibe-feed/). Local dev is unaffected.
export default defineConfig({
  base: "/vibe-feed/",
  plugins: [react()],
});