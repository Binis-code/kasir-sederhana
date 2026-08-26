import { defineConfig } from "@playwright/test";
import "dotenv/config";

// E2E memakai data demo DB lokal (MySQL via docker `kasir-mysql`) — pastikan
// Docker Desktop hidup sebelum menjalankan: pnpm test:e2e
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  workers: 1, // urutan penting karena berbagi DB demo yang sama
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    channel: "chrome", // pakai Chrome terpasang; tanpa download browser
    viewport: { width: 1280, height: 720 },
    trace: "retain-on-failure",
  },
  // Dua server terpisah supaya Playwright menunggu KEDUANYA siap — sebelumnya
  // hanya vite yang ditunggu, API (:3000) belum listen saat test mulai.
  webServer: [
    {
      command: "pnpm exec tsx watch server/index.ts",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "pnpm exec vite",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
