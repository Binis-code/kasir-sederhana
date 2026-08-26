# Master Prompt — Kios Nusa POS & Shop Management

Dokumen ini adalah **prompt utama yang dapat langsung disalin** untuk membangun ulang aplikasi Kios Nusa dari nol sampai mencapai cakupan fungsional, arsitektur, dan pengalaman pengguna aplikasi saat ini.

## Cara Menggunakan

Salin seluruh isi bagian **Master Prompt** di bawah ini ke agen pengembang atau AI coding assistant. Berikan akses ke repositori yang menjadi target. Jika repositori sudah ada, agen wajib mengaudit struktur yang ada terlebih dahulu dan meneruskan arsitektur saat ini, bukan membuat ulang proyek secara destruktif.

---

# Master Prompt

Anda adalah **Senior Product Engineer, POS Domain Architect, dan Mobile-First UX Engineer**. Bangun aplikasi web **Kios Nusa POS & Shop Management**, sebuah sistem kasir dan operasional toko kecil yang elegan, cepat, aman, dan nyaman digunakan setiap hari oleh pemilik maupun kasir.

Tujuan utama aplikasi ini adalah memungkinkan toko menjalankan transaksi penjualan dengan cepat, menjaga stok tetap akurat, memantau piutang dan arus kas, serta memberi pemilik visibilitas operasional tanpa membebani pengguna dengan antarmuka yang rumit.

## 1. Konteks Produk dan Prinsip Utama

Rancang aplikasi sebagai **operating cockpit toko ritel kecil**, bukan dashboard SaaS generik. Bahasa antarmuka utama adalah **Bahasa Indonesia**. Gunakan nada yang ringkas, membantu, dan operasional, misalnya “Stok menipis”, “Buka kasir”, dan “Piutang perlu ditindaklanjuti”.

Pengguna utama adalah pemilik toko, admin operasional, dan kasir. Kasir harus dapat menyelesaikan transaksi tanpa berpindah halaman berulang kali. Pemilik harus dapat melihat ringkasan penjualan, nilai persediaan, piutang, arus kas, dan tindakan yang perlu dilakukan segera.

| Prinsip | Implementasi yang diharapkan |
|---|---|
| Cepat | Pencarian produk, scan barcode, tombol Kasir Baru, dan checkout harus mudah dijangkau. |
| Akurat | Setiap penjualan, pembelian, opname, dan penyesuaian harus menghasilkan jejak inventori. |
| Mobile-first | Fitur inti kasir, pencarian, scan, dan navigasi harus nyaman di layar ponsel. |
| Aman | Aksi sensitif harus dibatasi oleh peran dan divalidasi di server. |
| Jelas | Gunakan status, badge, empty state, konfirmasi, dan notifikasi yang mudah dipahami. |

## 2. Teknologi dan Konvensi Proyek

Gunakan atau pertahankan stack berikut. Jangan migrasikan ke Laravel atau Filament kecuali diminta secara eksplisit pada tugas terpisah.

| Lapisan | Teknologi |
|---|---|
| Frontend | React 19, TypeScript, Vite, Wouter, Tailwind CSS 4 |
| Komponen UI | Komponen shadcn/Radix yang sudah tersedia dan ikon Lucide |
| Backend | Express dan tRPC dengan Zod untuk validasi kontrak |
| Database | MySQL atau TiDB melalui Drizzle ORM dan `mysql2` |
| Autentikasi | Manus OAuth yang sudah terintegrasi pada scaffold |
| Pengujian | Vitest untuk helper, kalkulasi POS, dan prosedur penting |
| Pencetakan | Browser print dengan stylesheet thermal 80 mm |

Gunakan struktur yang sudah ada: skema database di `drizzle/schema.ts`, query/helper database di `server/db.ts`, prosedur tRPC di `server/routers/`, dan halaman React di `client/src/`. Semua input dari klien harus divalidasi menggunakan Zod. Semua nilai uang disimpan sebagai **integer rupiah**, bukan floating point.

## 3. Peran dan Akses

Implementasikan peran minimal berikut.

| Peran | Hak akses |
|---|---|
| Owner/Admin | Mengelola pengguna, katalog, harga, pemasok, pembelian, laporan, stok, piutang, dan pengaturan. |
| Kasir | Membuka kasir, mencari/scan produk, mengelola keranjang, menerapkan diskon sesuai kebijakan, menyelesaikan transaksi, dan mencetak struk. |

Lindungi seluruh prosedur kasir dengan `protectedProcedure`. Lindungi operasi administrasi seperti manajemen pengguna, katalog, harga, pembelian, penyesuaian stok, dan laporan sensitif dengan `adminProcedure` atau middleware ekuivalen. Jangan hanya menyembunyikan menu di frontend; validasi akses harus terjadi di backend.

Untuk admin pertama, gunakan akun owner yang `openId`-nya sesuai dengan `OWNER_OPEN_ID`, lalu promosi akun tersebut ke peran admin pada proses upsert OAuth. Berikan dokumentasi setup yang jelas.

## 4. Model Data dan Aturan Bisnis

Gunakan MySQL dengan tabel inti berikut. Tambahkan indeks untuk kolom yang sering dicari seperti barcode, nomor invoice, tanggal transaksi, serta foreign key yang sesuai bila konfigurasi database mendukungnya.

| Domain | Entitas dan field minimum |
|---|---|
| Pengguna | `users`: openId, nama, email, loginMethod, role, waktu login terakhir. |
| Pemasok | `suppliers`: nama, telepon, alamat, catatan. |
| Produk | `products`: nama, kategori, barcode utama, stok, stok minimum, status aktif. |
| Varian satuan | `productVariants`: productId, label satuan/ukuran, barcode, harga jual, harga modal. Contoh: Pack 200 g, Botol 2 L, Karung 5 kg. |
| Pembelian | `purchases` dan `purchaseItems`: pemasok, nomor invoice, status, kuantitas, harga beli, total. |
| Penjualan | `sales` dan `saleItems`: invoice, kasir, subtotal, diskon total, total, metode pembayaran, varian, kuantitas, harga satuan, diskon item. |
| Pembayaran | Catat metode pembayaran cash, QRIS, debit, kredit, nominal bayar, nominal kembali, dan referensi bila diperlukan. |
| Piutang | `receivables`: saleId, pelanggan, jatuh tempo, nominal, nominal terbayar, status open/partial/paid. Tambahkan `receivablePayments` untuk histori pelunasan. |
| Persediaan | `inventoryMovements`: productId/variantId, tipe purchase/sale/opname/adjustment, kuantitas positif atau negatif, referensi dokumen, catatan, dan waktu. |
| Stok opname | `stockOpnames` dan `stockOpnameItems`: tanggal, penanggung jawab, stok sistem, stok fisik, selisih, alasan, dan status finalisasi. |
| Keuangan sederhana | `cashEntries`: tipe income/expense, kategori, deskripsi, nominal, tanggal, user pembuat. |
| Promosi | `discountRules` dan `vouchers`: kode, tipe fixed/percentage, nilai, periode berlaku, batas penggunaan, status. |

Saat penjualan diselesaikan, lakukan proses berikut dalam transaksi database: validasi stok, hitung subtotal, hitung diskon item, hitung diskon transaksi dan voucher, buat sale, buat sale items, simpan pembayaran, kurangi stok, buat inventory movement, dan buat piutang jika pembayaran belum lunas. Total akhir tidak boleh negatif. Jangan pernah mempercayai total yang dihitung oleh klien tanpa perhitungan ulang di server.

## 5. Modul Fungsional

### 5.1 Dashboard Operasional

Bangun dashboard real-time atau near-real-time dengan kartu ringkasan untuk penjualan hari ini, jumlah transaksi, nilai persediaan, piutang berjalan, pendapatan lain, dan pengeluaran. Sertakan grafik penjualan harian atau mingguan, ringkasan laba dasar, serta panel “Perlu perhatian”.

Panel perhatian harus memprioritaskan stok menipis, piutang jatuh tempo, opname terjadwal, dan pembelian yang belum diterima. Semua angka harus memiliki format rupiah Indonesia yang konsisten.

### 5.2 Katalog Produk dan Pemasok

Sediakan daftar produk yang dapat dicari, ditambah, diedit, diarsipkan, dan dilihat detailnya. Produk mendukung barcode utama serta banyak varian ukuran/satuan dengan barcode dan harga berbeda. Tampilkan stok, batas stok minimum, harga jual, harga modal, kategori, dan status stok.

Sediakan halaman pemasok dengan informasi kontak, riwayat pembelian, dan hubungan ke dokumen pembelian.

### 5.3 Pembelian dan Persediaan

Sediakan alur membuat pembelian, menerima barang sebagian atau penuh, dan memperbarui stok. Setiap penerimaan harus menulis `inventoryMovement` bertipe purchase. Sediakan halaman histori mutasi stok yang dapat difilter menurut produk, tipe, dan rentang tanggal.

Sediakan modul stok opname. Pengguna memulai sesi, mencatat stok fisik, melihat selisih dengan stok sistem, memberi alasan penyesuaian, lalu memfinalisasi sesi. Finalisasi membuat mutasi stok bertipe opname atau adjustment.

### 5.4 Layar Kasir

Layar kasir adalah halaman paling cepat dan paling penting. Layout desktop menggunakan daftar produk di satu sisi dan keranjang transaksi di sisi lain. Pada mobile, gunakan layout vertikal dengan ringkasan total dan tombol bayar yang mudah dijangkau.

Kasir harus dapat melakukan hal berikut tanpa alur berbelit:

1. Mencari produk berdasarkan nama, kategori, SKU, atau barcode.
2. Menambahkan produk ke keranjang, mengubah kuantitas, dan menghapus item.
3. Memilih varian satuan/ukuran beserta harganya.
4. Menetapkan diskon nominal atau persentase pada item dan pada transaksi.
5. Memasukkan serta memvalidasi voucher.
6. Memilih metode pembayaran cash, QRIS, debit, atau kredit.
7. Mencatat piutang dan jatuh tempo bila pembayaran tidak lunas.
8. Menyelesaikan transaksi secara atomik, menampilkan status sukses, lalu menawarkan cetak struk.

Tampilkan ringkasan subtotal, diskon, pajak jika bisnis mengaktifkannya, total, uang diterima, dan kembalian. Tambahkan perlindungan terhadap kuantitas nol, stok tidak cukup, diskon melebihi harga, dan checkout keranjang kosong.

### 5.5 Struk Thermal

Sediakan area cetak khusus dengan `@media print` untuk kertas thermal 80 mm. Struk harus menampilkan nama toko, nomor invoice, tanggal/waktu, kasir, daftar barang, kuantitas, harga, diskon, subtotal, total, metode pembayaran, dan pesan terima kasih.

Gunakan `window.print()` sebagai jalur utama karena browser dapat meneruskan dialog cetak ke printer thermal USB yang telah diinstal pada sistem. Bila direct USB atau WebUSB tidak tersedia, tampilkan pesan fallback yang jelas tanpa membuat transaksi gagal.

## 6. Pencarian Global dan Pemindai Barcode

Pencarian global harus tersedia dari header semua halaman desktop dan mobile. Input mendukung nama produk, kategori, SKU, serta barcode. Hasil menampilkan nama, barcode, kategori, stok tersisa, dan harga. Memilih hasil harus menambahkan produk ke transaksi kasir lalu membuka layar kasir.

Saat kolom pencarian baru dibuka tanpa query, tampilkan dua kelompok informasi:

| Kelompok | Sumber data dan perilaku |
|---|---|
| Terakhir dicari | Simpan raw query atau barcode yang benar-benar disubmit di `localStorage`; jangan mencampurnya dengan nama produk yang dipilih. |
| Sering dicari | Urutkan produk berdasarkan jumlah pemilihan hasil pencarian yang sebenarnya. Simpan hitungan per SKU atau product ID secara terpisah. |

Tambahkan tombol scan di dalam pencarian. Pada mobile, tombol ini membuka modal kamera dengan `navigator.mediaDevices.getUserMedia`, memprioritaskan kamera belakang melalui `facingMode: environment`, lalu memakai `BarcodeDetector` untuk format EAN-13, EAN-8, Code 128, UPC, dan QR. Setelah barcode terbaca, isi kolom pencarian dan tampilkan hasil cocok. Bila kamera tidak tersedia, izin ditolak, atau `BarcodeDetector` tidak didukung, tampilkan fallback yang meminta pengguna memasukkan barcode secara manual. Hentikan seluruh media track ketika modal ditutup.

## 7. Navigasi dan Desain UX

Gunakan visual yang elegan tetapi operasional: latar hangat netral, hijau hutan sebagai warna aksi utama, kartu putih dengan shadow lembut, dan tipografi yang jelas. Hindari tampilan dashboard SaaS generik yang berlebihan.

### Desktop

Gunakan sidebar tetap yang dapat di-collapse. Saat terbuka, tampilkan identitas toko, kelompok menu Workspace, Operasional, dan Keuangan, status toko, serta profil pengguna. Saat collapse, gunakan ikon dengan tooltip agar area konten lebih luas.

Tampilkan badge dinamis di sidebar untuk jumlah produk dengan stok di bawah minimum dan jumlah piutang jatuh tempo. Header harus memiliki tombol “Kasir baru”, pencarian global, tombol notifikasi, dan pengaturan.

Dropdown notifikasi harus menyajikan detail barang stok menipis dan piutang jatuh tempo, bukan sekadar angka. Setiap item dapat diarahkan ke halaman Persediaan atau Piutang.

### Mobile

Optimalkan aplikasi untuk ponsel. Header harus ringkas dengan menu, judul halaman, pemicu pencarian, akses kasir, dan notifikasi. Gunakan **bottom navigation** untuk lima tujuan berfrekuensi tinggi: Ringkasan, Kasir, Produk, Stok, dan Piutang. Tampilkan badge pada menu Stok dan Piutang bila perlu perhatian.

Bottom navigation harus memperhatikan `env(safe-area-inset-bottom)` untuk perangkat dengan gesture bar atau home indicator. Beri padding tambahan pada konten agar tidak tertutup oleh navigasi bawah. Semua tombol penting memiliki target sentuh nyaman, minimal sekitar 44 px, dan status fokus yang terlihat.

## 8. Laporan dan Keuangan

Sediakan laporan dengan filter tanggal untuk penjualan, jumlah transaksi, produk terlaris, diskon, metode pembayaran, piutang, pemasukan lain, pengeluaran, dan laba dasar. Laba dasar dihitung dari harga jual dikurangi harga modal dan pengeluaran terkait, dengan label yang jujur apabila data modal belum lengkap.

Sediakan halaman pemasukan dan pengeluaran dengan kategori, deskripsi, nominal, tanggal, dan pembuat entri. Tampilkan ringkasan arus kas sederhana pada dashboard.

## 9. Seed Data dan Setup

Sediakan script seed idempoten yang aman dijalankan berulang. Seed minimal memasukkan contoh sembako dan minuman, barcode nyata-format, stok dan stok minimum, varian ukuran/satuan, harga jual dan modal, serta beberapa pemasok.

Dokumentasi setup harus menjelaskan konfigurasi `DATABASE_URL`, migrasi Drizzle, pemakaian seed, pembuatan admin pertama dengan `OWNER_OPEN_ID`, dan pengaturan printer dari browser/sistem operasi.

## 10. Rencana Implementasi yang Wajib Diikuti

Kerjakan secara bertahap, namun jangan berhenti pada mockup visual.

| Tahap | Hasil yang wajib tersedia |
|---|---|
| 1. Audit | Baca struktur proyek, komponen bawaan, skema, router, dan daftar tugas sebelum mengubah kode. |
| 2. Data | Buat atau perbarui skema Drizzle, hasilkan migrasi, review SQL, lalu terapkan migrasi secara aman. |
| 3. Backend | Buat helper database dan prosedur tRPC tervalidasi untuk katalog, transaksi, stok, piutang, laporan, dan role guard. |
| 4. UI | Buat halaman dan komponen reusable dengan loading, error, empty, success, dan states responsif. |
| 5. Kasir | Hubungkan checkout dengan backend dan mutasi stok atomik. Jangan hanya melakukan state lokal. |
| 6. Mobile | Tambahkan bottom navigation, safe area, pencarian overlay, kamera barcode, serta pemeriksaan di viewport 375 px. |
| 7. Verifikasi | Jalankan typecheck, Vitest, dan screenshot desktop/mobile. Perbaiki semua regresi sebelum checkpoint. |

## 11. Standar Kualitas dan Pengujian

Tulis unit test untuk kalkulasi subtotal, diskon item, diskon transaksi, total tidak negatif, pencarian nama, pencarian barcode, riwayat raw query, dan penghitungan frekuensi produk hasil scan/pencarian. Tambahkan test prosedur backend untuk otorisasi dan validasi checkout kritis.

Sebelum menyatakan selesai, jalankan:

```bash
pnpm check
pnpm test
```

Verifikasi tampilan minimal pada desktop 1280 × 720 dan mobile 375 × 812. Pastikan sidebar desktop tidak muncul di atas bottom navigation mobile, konten tidak tertutup navigasi fixed, dan seluruh tombol utama tetap dapat digunakan pada layar kecil.

## 12. Batasan dan Larangan

Jangan membuat ulasan, rating, atau testimoni pelanggan palsu. Jangan menyimpan file media besar di direktori frontend publik. Jangan memakai floating point untuk rupiah. Jangan mempercayai nilai total dari klien. Jangan menambahkan dependency baru jika kemampuan yang dibutuhkan sudah tersedia. Jangan menghapus atau menimpa data produksi secara destruktif.

Jangan mengganti desain dengan landing page atau e-commerce publik; ini adalah aplikasi operasional internal. Jangan menampilkan menu placeholder tanpa menjelaskan bahwa fitur tersebut belum aktif. Jangan mengandalkan proses background yang hidup terus-menerus pada runtime autoscale.

## 13. Definisi Selesai

Pekerjaan dianggap selesai ketika aplikasi memiliki dashboard operasional, role-based access, katalog dengan varian/barcode, pembelian, inventori dan opname, kasir cepat, diskon dan voucher, metode pembayaran, piutang, cash entry, laporan, struk thermal, pencarian global, pemindai barcode kamera dengan fallback, notifikasi detail, sidebar collapse desktop, bottom navigation mobile, seed idempoten, first-admin flow, migrasi database, prosedur backend tervalidasi, dan test serta verifikasi visual yang lulus.

Saat melaporkan hasil, ringkas perubahan yang selesai, daftar fitur yang masih belum terhubung ke data produksi bila ada, hasil typecheck/test, dan checkpoint atau commit yang dapat ditinjau.
