import { test, expect } from "@playwright/test";

async function login(page, username: string, password: string) {
  await page.goto("/login");
  await page.fill("#username", username);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
}

test("password salah ditolak dengan pesan", async ({ page }) => {
  await login(page, "owner", "salah-banget");
  await expect(page.locator("body")).toContainText(/salah|Kredensial/i, { timeout: 10_000 });
});

test("owner bisa login dan melihat shell aplikasi", async ({ page }) => {
  await login(page, "owner", "nusa2026");
  await page.waitForURL("/", { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Kios Nusa" })).toBeVisible();
});
