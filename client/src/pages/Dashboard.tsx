import { useState } from "react";
import { trpc } from "../lib/trpc.js";
import { formatRupiah } from "@shared/money.js";
import { Card, CardHeader, Badge, Spinner, cn, toast } from "../components/ui.js";
import { BarcodeScanner } from "../components/BarcodeScanner.js";
import { lookupBarcode } from "../lib/barcode-lookup.js";
import { Link, useLocation } from "wouter";
import { AlertTriangle, HandCoins, PackageSearch, Truck, ClipboardList, ScanLine } from "lucide-react";

export default function Dashboard() {
  const q = trpc.dashboard.summary.useQuery(undefined, { refetchInterval: 30_000 });
  const [, navigate] = useLocation();
  const [scanOpen, setScanOpen] = useState(false);

  async function handleScan(code: string) {
    const hit = await lookupBarcode(code);
    if (!hit) { toast(`Barcode ${code} tidak ditemukan`, "err"); return; }
    navigate(`/pos?add=${hit.variantId}`);
    toast(`${hit.name} siap di Kasir`);
  }

  if (q.isLoading) return <Spinner className="min-h-[50vh]" />;
  if (!q.data) return <p className="p-6 text-sm text-gray-500">Data tidak tersedia.</p>;

  const d = q.data;
  const maxWeekly = Math.max(1, ...d.weekly.map(w => w.total));

  return (
    <div className="space-y-4 p-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <StatCard title="Penjualan hari ini" value={formatRupiah(d.todaySales)} sub={`${d.todayTrx} transaksi`} tone="brand" />
        <StatCard title="Nilai persediaan" value={formatRupiah(d.inventoryValue)} sub="harga modal semua varian aktif" />
        <StatCard title="Piutang berjalan" value={formatRupiah(d.receivableOutstanding)} sub="belum lunas" tone={d.receivableOutstanding > 0 ? "red" : undefined} />
        <StatCard title="Pemasukan lain (bulan ini)" value={formatRupiah(d.monthOtherIncome)} />
        <StatCard title="Pengeluaran (bulan ini)" value={formatRupiah(d.monthExpense)} tone={d.monthExpense > 0 ? "amber" : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Weekly chart */}
        <Card>
          <CardHeader title="Penjualan 7 hari terakhir" />
          <div className="flex h-44 items-end gap-2 p-4">
            {d.weekly.length === 0 && <p className="text-xs text-gray-400">Belum ada transaksi.</p>}
            {d.weekly.map(w => {
              const label = new Date(`${w.day}T12:00:00`).toLocaleDateString("id-ID", { weekday: "short" });
              return (
              <div key={w.day} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-gray-500">{w.total > 0 ? formatRupiah(w.total).replace("Rp", "") : ""}</span>
                <div
                  className={cn("w-full rounded-t-md", w.total > 0 ? "bg-brand-500" : "bg-warm-100")}
                  style={{ height: `${Math.max(4, (w.total / maxWeekly) * 110)}px` }}
                  aria-label={`${w.day}: ${formatRupiah(w.total)}`}
                />
                <span className="text-[10px] font-medium text-gray-600">{label}</span>
              </div>
              );
            })}
          </div>
        </Card>

        {/* Attention panel */}
        <Card>
          <CardHeader title="Perlu perhatian" subtitle="Prioritas tindakan hari ini" />
          <div className="divide-y divide-warm-100">
            {d.attention.lowStock.length === 0 &&
             d.attention.dueReceivables.length === 0 &&
             d.attention.pendingPurchases.length === 0 &&
             d.attention.openOpnames.length === 0 ? (
              <p className="p-4 text-xs text-gray-400">Tidak ada. Semua berjalan aman.</p>
            ) : null}
            {d.attention.lowStock.map(p => (
              <AttentionRow key={`ls${p.id}`} href="/inventory"
                icon={<PackageSearch size={16} className="text-amber-600" />}
                title={`Stok menipis — ${p.name}`}
                detail={`sisa ${p.stock} · minimum ${p.minStock}`} />
            ))}
            {d.attention.dueReceivables.map(r => (
              <AttentionRow key={`dr${r.id}`} href="/receivables"
                icon={<HandCoins size={16} className="text-red-600" />}
                title={`Piutang jatuh tempo — ${r.customerName}`}
                detail={`${formatRupiah(r.amount)} · tempo ${r.dueDate}`} />
            ))}
            {d.attention.pendingPurchases.map(p => (
              <AttentionRow key={`pp${p.id}`} href="/purchases"
                icon={<Truck size={16} className="text-blue-600" />}
                title={`Pembelian belum lengkap — ${p.invoiceNo}`}
                detail={`status: ${p.status}`} />
            ))}
            {d.attention.openOpnames.map(o => (
              <AttentionRow key={`oo${o.id}`} href="/opname"
                icon={<ClipboardList size={16} className="text-gray-600" />}
                title={`Opname belum difinalisasi — ${o.code}`}
                detail="selesaikan sesi stok fisik" />
            ))}
          </div>
        </Card>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button onClick={() => setScanOpen(true)} aria-label="Scan barang ke kasir">
          <Card className="flex min-h-[44px] items-center justify-center gap-2 p-3 text-center text-sm font-semibold text-brand-700 hover:bg-brand-50">
            <ScanLine size={16} /> Scan &amp; jual
          </Card>
        </button>
        <QuickLink href="/pos" label="Buka kasir" />
        <QuickLink href="/products" label="Kelola produk" />
        <QuickLink href="/inventory" label="Cek stok" />
        <QuickLink href="/reports" label="Lihat laporan" />
      </div>

      {scanOpen && (
        <BarcodeScanner
          onDetect={(code) => { setScanOpen(false); void handleScan(code); }}
          onClose={() => setScanOpen(false)}
        />
      )}
    </div>
  );
}

function StatCard({ title, value, sub, tone }: { title: string; value: string; sub?: string; tone?: "brand" | "red" | "amber" }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{title}</p>
      <p className={cn("mt-1 truncate text-lg font-bold sm:text-xl",
        tone === "brand" && "text-brand-700",
        tone === "red" && "text-red-600",
        tone === "amber" && "text-amber-600",
        !tone && "text-gray-900")}>{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-gray-400">{sub}</p> : null}
    </Card>
  );
}

function AttentionRow({ href, icon, title, detail }: { href: string; icon: React.ReactNode; title: string; detail: string }) {
  return (
    <Link href={href} className="flex items-start gap-2 px-4 py-2.5 hover:bg-warm-50">
      <span className="mt-0.5">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-gray-800">{title}</span>
        <span className="block text-[11px] text-gray-500">{detail}</span>
      </span>
      <AlertTriangle size={0} className="hidden" />
    </Link>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href}>
      <Card className="min-h-[44px] p-3 text-center text-sm font-medium text-brand-700 hover:bg-brand-50">{label}</Card>
    </Link>
  );
}
