import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Minimal config. Dev server on :5173.
export default defineConfig({
  plugins: [react()],
});