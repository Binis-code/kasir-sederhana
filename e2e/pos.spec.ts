import { test, expect } from "@playwright/test";

async function login(page) {
  await page.goto("/login");
  await page.fill("#username", "owner");
  await page.fill("#password", "nusa2026");
  await page.click("button[type=submit]");
  await page.waitForURL("/", { timeout: 15_000 });
}

test("alur kasir: cari produk → pilih varian → bayar pas → sukses", async ({ page }) => {
  await login(page);
  await page.goto("/pos");

  // cari produk demo berstok (Beras Pandan Wangi, seed stabil)
  const search = page.getByLabel("Cari produk");
  await search.fill("Beras");
  await page.waitForTimeout(800); // debounce katalog

  // klik kartu produk pertama pada grid katalog
  await page.locator("section .grid button").first().click();

  // pilih varian aktif pertama pada modal
  const pickButtons = page.locator('[role="dialog"] ul button:not([disabled])');
  await expect(pickButtons.first()).toBeVisible({ timeout: 10_000 });
  await pickButtons.first().click();

  // keranjang berisi item
  await expect(page.locator("body")).toContainText(/Keranjang \(\d+ item\)/);

  // metode cash, isi nominal pas lalu bayar
  await page.getByRole("button", { name: "Pas" }).click();
  await page.getByRole("button", { name: /^Bayar/ }).click();

  await expect(page.locator("body")).toContainText("Transaksi berhasil", { timeout: 15_000 });
});

test("deep link /pos?add=variantId memasukkan barang ke keranjang", async ({ page }) => {
  await login(page);

  // ambil satu varian aktif dari API (konteks terotentikasi via cookie browser)
  const variantId = await page.evaluate(async () => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "owner", password: "nusa2026" }),
    });
    void res;
    const r = await fetch("/trpc/products.list?input=" + encodeURIComponent(JSON.stringify({ limit: 30 })));
    const body = await r.json();
    for (const it of body.result.data.items) {
      const d = await fetch("/trpc/products.get?input=" + encodeURIComponent(JSON.stringify({ id: it.id })));
      const db = await d.json();
      const v = db.result.data.variants.find((x) => x.isActive && x.stock >= 1);
      if (v) return v.id;
    }
    return 0;
  });
  test.skip(!variantId, "tidak ada varian aktif berstok di data demo");

  await page.goto(`/pos?add=${variantId}`);
  await expect(page.locator("body")).toContainText(/Keranjang \(1 item\)/);
});
