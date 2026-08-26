import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // unit test saja — E2E Playwright dijalankan terpisah via `pnpm test:e2e`
    include: ["tests/**/*.test.ts"],
  },
});
