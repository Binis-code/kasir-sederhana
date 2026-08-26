import { test, expect } from "@playwright/test";

test("halaman produk: cari, buka form edit, dan sesuaikan stok", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#username", "owner");
  await page.fill("#password", "nusa2026");
  await page.click("button[type=submit]");
  await page.waitForURL("/", { timeout: 15_000 });

  await page.goto("/products");

  // kartu produk pertama tampil dengan tombol aksi admin
  const firstCard = page.locator(".grid > *").first();
  await expect(firstCard).toBeVisible({ timeout: 10_000 });
  await expect(firstCard.getByRole("button", { name: /± Stok/ })).toBeVisible();

  // buka form edit via tombol Edit
  await firstCard.getByRole("button", { name: /Edit/ }).click();
  await expect(page.locator('[role="dialog"]')).toContainText("Edit produk");
  await page.locator('[role="dialog"]').getByRole("button", { name: "Batal" }).click();

  // sesuaikan stok +1 dengan alasan
  await firstCard.getByRole("button", { name: /± Stok/ }).click();
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toContainText("Sesuaikan stok", { timeout: 10_000 });
  await dialog.locator("select").first().selectOption({ index: 1 });
  await dialog.getByPlaceholder("0").fill("1");
  await dialog.getByPlaceholder(/barang rusak/).fill("uji e2e otomatis");
  await dialog.getByRole("button", { name: /^\+1$/ }).click();

  // modal tertutup setelah sukses
  await expect(dialog).toBeHidden({ timeout: 10_000 });
});
