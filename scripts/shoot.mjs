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
  await page.fill("#username", "owner");
  await page.fill("#password", process.env.OWNER_PASSWORD ?? "nusa2026");
  await Promise.all([
    page.waitForURL("**/", { timeout: 15000 }).catch(() => undefined),
    page.click("button[type=submit]"),
  ]);
  await page.waitForLoadState("networkidle");
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });

  // ---------- DESKTOP 1280x720 ----------
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const d = await desktop.newPage();
  await d.goto(BASE, { waitUntil: "networkidle" });
  note("belum auth -> form login tampil", await d.locator("#username").isVisible());
  await d.screenshot({ path: `${OUT}/desktop-login.png` });

  await login(d);
  note("dashboard tercapai setelah login", !d.url().includes("/login"));
  await d.waitForSelector("text=Perlu perhatian", { timeout: 10000 }).catch(() => undefined);
  await d.screenshot({ path: `${OUT}/desktop-dashboard.png` });

  // Kasir: tambah item via pencarian + varian + bayar
  await d.goto(`${BASE}/pos`, { waitUntil: "networkidle" });
  await d.fill('input[aria-label="Cari produk"]', "Beras");
  await d.waitForTimeout(600);
  await d.click("text=Beras Pandan Wangi");
  await d.waitForTimeout(500);
  await d.click("text=Karung 5 kg");
  await d.waitForTimeout(300);
  await d.click('button:has-text("Pas")').catch(() => undefined);
  const bayarBtn = d.locator('button:has-text("Bayar")').first();
  await bayarBtn.click();
  await d.waitForSelector("text=Transaksi berhasil", { timeout: 10000 });
  note("checkout desktop sukses", true);
  await d.screenshot({ path: `${OUT}/desktop-kasir-sukses.png` });

  // Struk
  const printLink = d.locator('a:has-text("Cetak struk")');
  if (await printLink.count()) {
    await printLink.click();
    await d.waitForLoadState("networkidle");
    await d.screenshot({ path: `${OUT}/desktop-struk.png` });
    note("halaman struk terbuka", d.url().includes("/receipt"));
  }

  // Global search overlay
  await d.goto(`${BASE}/pos`, { waitUntil: "networkidle" });
  await d.keyboard.press("/");
  await d.waitForSelector('[aria-label="Pencarian global"]', { timeout: 5000 });
  await d.keyboard.type("aqua");
  await d.waitForTimeout(700);
  await d.screenshot({ path: `${OUT}/desktop-search.png` });
  note("global search overlay terbuka", true);

  // Customer Display (/display)
  await d.goto(`${BASE}/display`, { waitUntil: "networkidle" });
  const displayTitle = await d.locator("h1:has-text('Kios Nusa')").isVisible();
  note("customer facing display (/display) tampil", displayTitle);

  // Multi-Cabang & Transfer (/outlets)
  await d.goto(`${BASE}/outlets`, { waitUntil: "networkidle" });
  const outletsHeader = await d.locator("h2:has-text('Manajemen Multi-Cabang')").isVisible();
  note("halaman multi-cabang (/outlets) aktif", outletsHeader);

  // Barcode & Price Tag Generator (/barcodes)
  await d.goto(`${BASE}/barcodes`, { waitUntil: "networkidle" });
  const barcodeHeader = await d.locator("h2:has-text('Cetak Barcode')").isVisible();
  note("halaman cetak barcode & rak (/barcodes) aktif", barcodeHeader);

  await desktop.close();

  // ---------- MOBILE 375x812 ----------
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
  const fabDash = m.locator('button.fixed.right-4[aria-label="Scan barang ke kasir"]');
  note("FAB scan tampil di dashboard (mobile)", await fabDash.isVisible());

  // bottom nav ada & menempel di bawah viewport
  const bottomNav = m.locator('nav[aria-label="Navigasi bawah"]');
  note("bottom navigation tampil", await bottomNav.isVisible());
  const navBox = await bottomNav.boundingBox();
  note("bottom nav menempel di bawah viewport", !!navBox && Math.abs(navBox.y + navBox.height - 812) < 4);

  await m.goto(`${BASE}/pos`, { waitUntil: "networkidle" });
  await m.screenshot({ path: `${OUT}/mobile-kasir.png` });
  const fabPos = await m.locator('button.fixed.right-4[aria-label="Scan barang ke kasir"]').isVisible().catch(() => false);
  note("FAB scan tersembunyi di Kasir (sudah ada tombol sendiri)", !fabPos);

  const sidebarVisible = await m.locator('aside[aria-label="Sidebar desktop"]').isVisible().catch(() => false);
  note("sidebar desktop tidak tampil di mobile", !sidebarVisible);

  await m.goto(`${BASE}/products`, { waitUntil: "networkidle" });
  await m.screenshot({ path: `${OUT}/mobile-produk.png` });

  await mobile.close();
  await browser.close();

  console.log(results.join("\n"));
  const passed = results.filter((r) => r.startsWith("PASS")).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  if (passed !== results.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
