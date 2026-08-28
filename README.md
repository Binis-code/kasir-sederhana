# Kios Nusa POS & Shop Management

Aplikasi Kasir (Point of Sale) & Operasional Toko Retail / Kelontong modern, ringan, dan siap pakai. Menggunakan arsitektur embedded SQLite (zero-dependency, tanpa perlu instalasi database server terpisah), mobile-first UI, Bahasa Indonesia, serta fitur operasional toko lengkap.

**Repository Publik:** [https://github.com/Binis-code/kasir-sederhana](https://github.com/Binis-code/kasir-sederhana)

---

## Fitur Utama

- **Embedded SQLite Database**: Berjalan otomatis langsung ke file `kios_nusa.db` via `@libsql/client` (tanpa perlu MySQL/Docker).
- **Kasir & POS Cepat**:
  - Scan barcode kamera langsung (`BarcodeDetector` API).
  - Tahan / Parkir Keranjang (Hold Carts & Pending Orders) dengan label penanda & restore instan.
  - Multi-varian produk & harga grosir bertingkat (Tiered Wholesale Pricing).
  - Berbagai metode pembayaran (Cash, QRIS, Debit, Piutang).
- **Struk Digital & Thermal**:
  - Kirim struk pembelian langsung ke WhatsApp pelanggan dalam format teks markdown rapi.
  - Cetak struk thermal dengan toggle ukuran kertas 58 mm & 80 mm.
- **Manajemen Shift & Rekonsiliasi Laci Kas (Cash Drawer)**:
  - Buka shift dengan input modal kas awal.
  - Tutup shift dengan rekonsiliasi fisik kas laci vs ekspektasi sistem beserta catatan selisih (`cashDiff`).
- **Pembelian & Smart Reorder (Auto-PO)**:
  - Analisis laju penjualan 7 hari terakhir (*sales velocity*).
  - Rekomendasi kuantitas pesan ulang otomatis dan pembuatan PO 1-klik.
- **Inventori & Stok Opname**:
  - Pelacakan mutasi stok otomatis per transaksi kasir dan penerimaan PO.
  - Manajemen stok opname berkala.
- **Laporan & Export CSV**:
  - Rekap penjualan harian, metode bayar, produk terlaris, laba kotor, dan estimasi laba bersih.
  - Export satu klik laporan keuangan dan penjualan ke file `.csv`.
- **Backup Database 1-Klik**:
  - Snapshot file database SQLite instan ke folder `backups/`.
- **PWA (Progressive Web App)**:
  - Dapat di-install langsung ke homescreen Android / iOS / Desktop sebagai aplikasi mandiri.

---

## Setup Cepat (Menjalankan di Mesin Baru)

Prasyarat: **Node.js ≥ 20** dan **pnpm** (atau npm).

```bash
# 1. Clone repository
git clone https://github.com/Binis-code/kasir-sederhana.git
cd kasir-sederhana

# 2. Install dependencies
pnpm install

# 3. Setup file konfigurasi .env
cp .env.example .env

# 4. Terapkan database schema & data katalog awal (seed)
pnpm db:push
pnpm db:seed

# 5. Jalankan aplikasi (Web + Backend API)
pnpm dev
```

Aplikasi langsung dapat diakses di browser: **[http://localhost:5173](http://localhost:5173)**.

---

## Akun Login Default (Setelah Seed)

| Peran | Username | Password Default |
|---|---|---|
| **Owner** | `owner` | `KiosNusa!Owner26` |
| **Admin** | `admin` | `admin123` |
| **Kasir** | `kasir` | `kasir123` |

> *Catatan: Segera perbarui password melalui menu Pengguna (Sistem) setelah login pertama kali.*

---

## Testing & Verifikasi

```bash
# Unit test Vitest (22 passing)
pnpm test

# Type check TypeScript (0 error)
pnpm check

# Visual smoke & E2E browser tests (10 passing)
node scripts/shoot.mjs
```

---

## Struktur Folder

```
client/src/pages/    # Halaman UI (Kasir, Shift, Purchases, Inventory, Reports, ...)
server/routers/      # API tRPC backend (pos, shifts, backup, purchases, reports, ...)
drizzle/schema.ts    # Skema SQLite database Drizzle
shared/money.ts      # Utility kalkulasi rupiah, harga bertingkat, nota WA, CSV generator
public/manifest.json # PWA Web App Manifest
```

---

## Lisensi
MIT License.
