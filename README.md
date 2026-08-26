# Kios Nusa POS & Shop Management

Aplikasi kasir & operasional toko kecil: mobile-first, Bahasa Indonesia, dengan
katalog varian/barcode, pembelian, stok + opname, piutang, keuangan, laporan,
struk thermal 80mm, scan barcode kamera, dan peran owner/admin/kasir.

**Stack:** React 19 · Vite · tRPC · Drizzle ORM · MySQL 8 (Docker) · Tailwind 4

## Setup cepat (mesin baru)

Prasyarat: Node ≥ 20, pnpm, Docker Desktop.

```bash
pnpm install
docker compose up -d          # MySQL di 127.0.0.1:3306 (kasir-mysql)
cp .env.example .env          # lalu isi nilai nyata
pnpm db:push                  # terapkan skema Drizzle
pnpm db:seed                  # data demo: produk sembako, supplier, transaksi
pnpm dev                      # web :5173 + API :3000
```

`.env` minimal:

```
DATABASE_URL=mysql://kios:kios123@localhost:3306/kios_nusa
JWT_SECRET=<string acak panjang>
PORT=3000
OWNER_USERNAME=owner
OWNER_PASSWORD=<password kuat>
STORE_NAME=Kios Nusa
SEED_DEMO_SALES=1
```

> `JWT_SECRET` **wajib** saat `NODE_ENV=production` — server menolak start tanpanya.

## Akun default (setelah seed — SEGERA ganti via menu Sistem → Pengguna)

| Peran | Username | Password |
|---|---|---|
| Owner | dari `.env` (`owner`) | dari `.env` |
| Admin | `admin` | `admin123` (demo — segera ganti) |
| Kasir | `kasir` | `kasir123` (demo — segera ganti) |

## Perintah penting

| Perintah | Fungsi |
|---|---|
| `pnpm dev` | Jalankan web (:5173) + API (:3000) |
| `pnpm check` | Typecheck TypeScript |
| `pnpm test` | Unit test (Vitest, hanya `tests/`) |
| `pnpm test:e2e` | E2E Playwright (5 spec; butuh Docker MySQL hidup) |
| `pnpm db:push` | Terapkan schema → DB (dev cepat) |
| `pnpm db:generate` | Buat file migrasi SQL di `drizzle/migrations/` |
| `pnpm db:migrate` | Terapkan migrasi SQL (untuk produksi/staging) |
| `pnpm db:backup` | Dump DB ke `backups/*.sql` (retensi 14 hari) |
| `node scripts/probe.mjs` | Smoke test UI (login + cari produk di kasir) |

Alur skema yang disarankan: ubah `drizzle/schema.ts` → `pnpm db:generate`
(review SQL!) → `pnpm db:migrate`. Untuk iterasi lokal cepat boleh `db:push`,
tapi jangan di database produksi.

## Backup otomatis

Task Scheduler Windows: **KiosNusa DB Backup**, harian 21:00,
menjalankan `scripts/backup-db.ps1` → `backups/kios_nusa-*.sql`.
Uji manual: `pnpm db:backup`.

## Catatan operasional

- **Printer struk**: jalur utama `window.print()` — instal printer thermal 80mm
  di OS lalu pilih pada dialog cetak browser.
- **Scan barcode**: kamera belakang via `BarcodeDetector` (Chrome/Edge Android &
  desktop Chromium). Browser tak didukung → input manual tersedia.
- **Keamanan**: password default demo WAJIB diganti sebelum dipakai toko nyata;
  ganti password mencabut semua sesi aktif user tersebut.
- **Data**: semua nominal rupiah integer; setiap mutasi stok tercatat di
  `inventory_movements`; harga modal disimpan snapshot-nya per item penjualan.

## Struktur kode

```
client/src/pages   Halaman (Kasir, Products, Inventory, ...)
server/routers     Prosedur tRPC per domain (pos, products, inventory, ...)
drizzle/schema.ts  Skema DB (sumber kebenaran)
shared/            Helper lintas sisi (money.ts, search-utils.ts)
e2e/               Spec Playwright
tests/             Unit test Vitest
```
