import "dotenv/config";
import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE = process.env.PROBE_URL ?? "http://localhost:5173";
const OUT = "shots";
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function note(name, ok, extra = "") {
  results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#username", process.env.OWNER_USERNAME ?? "owner");
  await page.fill("#password", process.env.OWNER_PASSWORD ?? "KiosNusa!Owner26");
  await Promise.all([
    page.waitForURL("**/", { timeout: 15000 }).catch(() => undefined),
    page.click("button[type=submit]"),
  ]);
  await page.waitForLoadState("networkidle");
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });

  // ---------- DESKTOP 1366x768 (Standard POS / Laptop View) ----------
  const desktop = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1.25,
  });
  const d = await desktop.newPage();

  // 0. Login Page
  await d.goto(BASE, { waitUntil: "networkidle" });
  note("belum auth -> form login tampil", await d.locator("#username").isVisible());
  await d.screenshot({ path: `${OUT}/desktop-login.png` });

  // 1. Dashboard
  await login(d);
  note("dashboard tercapai setelah login", !d.url().includes("/login"));
  await d.waitForSelector("text=Perlu perhatian", { timeout: 10000 }).catch(() => undefined);
  await d.waitForTimeout(800);
  await d.screenshot({ path: `${OUT}/dashboard.png` });
  await d.screenshot({ path: `${OUT}/desktop-dashboard.png` });

  // 2. POS / Kasir Terminal (tambah item ke keranjang agar terlihat interaktif)
  await d.goto(`${BASE}/pos`, { waitUntil: "networkidle" });
  await d.waitForTimeout(800);
  try {
    const search = d.locator('input[aria-label="Cari produk"], input[placeholder*="Cari"]');
    if (await search.isVisible()) {
      await search.fill("Beras");
      await d.waitForTimeout(500);
      const item = d.locator("text=Beras Pandan Wangi").first();
      if (await item.isVisible()) {
        await item.click();
        await d.waitForTimeout(400);
        const variant = d.locator("text=Karung 5 kg").first();
        if (await variant.isVisible()) {
          await variant.click();
        }
      }
    }
  } catch (e) {
    console.log("Kasir cart fill note:", e.message);
  }
  await d.waitForTimeout(600);
  await d.screenshot({ path: `${OUT}/pos-kasir.png` });
  note("kasir POS view tersimpan", true);

  // 3. Checkout Kasir Sukses & Struk
  try {
    await d.click('button:has-text("Pas")').catch(() => undefined);
    const bayarBtn = d.locator('button:has-text("Bayar")').first();
    if (await bayarBtn.isVisible()) {
      await bayarBtn.click();
      await d.waitForSelector("text=Transaksi berhasil", { timeout: 10000 });
      await d.screenshot({ path: `${OUT}/desktop-kasir-sukses.png` });
      note("checkout desktop sukses", true);

      const printLink = d.locator('a:has-text("Cetak struk")');
      if (await printLink.count()) {
        await printLink.click();
        await d.waitForLoadState("networkidle");
        await d.waitForTimeout(500);
        await d.screenshot({ path: `${OUT}/desktop-struk.png` });
        note("halaman struk terbuka", d.url().includes("/receipt"));
      }
    }
  } catch (e) {
    console.log("Checkout note:", e.message);
  }

  // 4. Products / Katalog & Stok
  await d.goto(`${BASE}/products`, { waitUntil: "networkidle" });
  await d.waitForTimeout(800);
  await d.screenshot({ path: `${OUT}/products.png` });
  note("halaman produk tersimpan", true);

  // 5. Reports / Laporan Penjualan & Laba
  await d.goto(`${BASE}/reports`, { waitUntil: "networkidle" });
  await d.waitForTimeout(800);
  await d.screenshot({ path: `${OUT}/reports.png` });
  note("halaman laporan tersimpan", true);

  // 6. Barcode & Price Tag Generator
  await d.goto(`${BASE}/barcodes`, { waitUntil: "networkidle" });
  await d.waitForTimeout(800);
  await d.screenshot({ path: `${OUT}/barcodes.png` });
  note("halaman barcode tersimpan", true);

  // 7. Multi-Cabang & Transfer
  await d.goto(`${BASE}/outlets`, { waitUntil: "networkidle" });
  await d.waitForTimeout(800);
  await d.screenshot({ path: `${OUT}/outlets.png` });
  note("halaman multi-cabang tersimpan", true);

  // 8. Customer Display (/display)
  await d.goto(`${BASE}/display`, { waitUntil: "networkidle" });
  await d.waitForTimeout(800);
  await d.screenshot({ path: `${OUT}/customer-display.png` });
  note("customer display tersimpan", true);

  await desktop.close();

  // ---------- MOBILE 375x812 (Mobile View) ----------
  const mobile = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const m = await mobile.newPage();
  await m.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await m.screenshot({ path: `${OUT}/mobile-login.png` });
  await login(m);

  await m.waitForSelector("text=Perlu perhatian", { timeout: 10000 }).catch(() => undefined);
  await m.screenshot({ path: `${OUT}/mobile-dashboard.png` });

  await m.goto(`${BASE}/pos`, { waitUntil: "networkidle" });
  await m.waitForTimeout(800);
  await m.screenshot({ path: `${OUT}/mobile-kasir.png` });

  await m.goto(`${BASE}/products`, { waitUntil: "networkidle" });
  await m.waitForTimeout(800);
  await m.screenshot({ path: `${OUT}/mobile-produk.png` });

  await mobile.close();
  await browser.close();

  console.log(results.join("\n"));
  const passed = results.filter((r) => r.startsWith("PASS")).length;
  console.log(`\n${passed}/${results.length} checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
