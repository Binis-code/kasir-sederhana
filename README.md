# Kios Nusa POS & Shop Management

Aplikasi Kasir (Point of Sale) & Operasional Toko Retail / Kelontong modern, ringan, dan siap pakai. Menggunakan arsitektur embedded SQLite (zero-dependency, tanpa perlu instalasi database server terpisah), mobile-first UI, Bahasa Indonesia, serta fitur operasional toko lengkap.

**Repository Publik:** [https://github.com/Binis-code/kasir-sederhana](https://github.com/Binis-code/kasir-sederhana)

---

## Fitur Lengkap Kios Nusa POS

### 1. Kasir & Transaksi Cepat
- **Scan Barcode Kamera**: Deteksi barcode instan via kamera perangkat (`BarcodeDetector` API).
- **Layar Pelanggan (Customer Facing Display)**: Monitor sekunder sinkronisasi real-time via `BroadcastChannel` (`/display`).
- **Tahan / Parkir Keranjang (Hold Carts)**: Parkir pesanan pelanggan sementara & pulihkan instan.
- **AI Rekomendasi Cross-Selling**: Rekomendasi produk pendamping otomatis berdasarkan histori belanja.
- **Harga Grosir Bertingkat (Tiered Wholesale Pricing)**: Potongan harga otomatis berdasarkan kuantitas beli.
- **Multi Metode Pembayaran**: Tunai (Cash), QRIS, Debit, dan Piutang (Kredit Jatuh Tempo).
- **Trigger Laci Kas (Cash Drawer Kick)**: Sinyal `ESC p 0 25 250` untuk membuka laci kas otomatis.

### 2. Struk Digital & Thermal
- **WhatsApp Digital Receipt**: Kirim nota belanja berformat rapi langsung ke nomor WhatsApp pelanggan.
- **Cetak Struk Thermal**: Format cetak kompatibel ukuran 58 mm dan 80 mm.

### 3. Multi-Cabang & Transfer Stok (Multi-Outlet)
- **Isolasi Stok per Cabang**: Manajemen outlet/toko cabang dan gudang terpisah.
- **Surat Jalan & Transfer Stok**: Alur pengiriman & konfirmasi penerimaan barang antar-cabang.

### 4. Manajemen Stok & Kadaluarsa
- **Pelacakan Mutasi Inventori Otomatis**: Riwayat keluar/masuk per transaksi kasir, PO, dan penyesuaian.
- **Pelacakan Batch & Kadaluarsa (Expiry Tracker)**: Peringatan otomatis untuk produk mendekati kadaluarsa dalam 60 hari.
- **Saran Reorder Otomatis (Auto-PO)**: Rekomendasi pemesanan ulang berdasarkan kecepatan penjualan 7 hari terakhir (*sales velocity*).
- **Stok Opname Berkala**: Formulir audit stok fisik vs sistem.

### 5. Alat Bantu Toko & Import Data
- **Cetak Barcode & Label Harga Rak**: Generator stiker barcode produk & label harga rak toko siap cetak.
- **Import Massal Produk (CSV / Spreadsheet)**: Tambah ratusan produk sekaligus dengan template spreadsheet.
- **Export Laporan CSV**: Unduh rekap penjualan harian, metode bayar, produk terlaris, dan laba rugi ke file `.csv`.

### 6. Keuangan, Shift & Keamanan
- **Manajemen Shift Kasir**: Buka shift dengan modal awal & tutup shift dengan rekonsiliasi uang fisik laci kas (`cashDiff`).
- **Buku Kas Operasional**: Catat kas masuk dan biaya pengeluaran harian toko.
- **Buku Piutang Pelanggan**: Catat piutang, tanggal jatuh tempo, dan riwayat cicilan pelunasan.
- **Backup Database 1-Klik**: Snapshot cadangan database SQLite instan ke folder `backups/`.
- **PWA (Progressive Web App)**: Install sebagai aplikasi mandiri di Android / iOS / Desktop.

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

Aplikasi langsung dapat diakses di browser: **[http://localhost:5173](http://localhost:5173)**  
Layar display pelanggan: **[http://localhost:5173/display](http://localhost:5173/display)**

---

## Akun Login Default (Setelah Seed)

| Peran | Username | Password Default |
|---|---|---|
| **Owner** | `owner` | `KiosNusa!Owner26` |
| **Admin** | `admin` | `admin123` |
| **Kasir** | `kasir` | `kasir123` |

---

## Testing & Verifikasi

```bash
# Unit test Vitest (22 passed)
pnpm test

# Type check TypeScript (0 errors)
pnpm check

# Visual smoke & E2E browser tests (10 passed)
node scripts/shoot.mjs
```

---

## Lisensi
MIT License.
