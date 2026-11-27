import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/japaneseSystem.ts"],
  },
});