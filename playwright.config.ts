import { defineConfig } from "@playwright/test";

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
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
