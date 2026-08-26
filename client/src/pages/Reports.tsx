import { useMemo, useState } from "react";
import { trpc } from "../lib/trpc.js";
import { formatRupiah } from "@shared/money.js";
import { Card, CardHeader, Input, NativeSelect, Badge, Spinner, cn } from "../components/ui.js";

function rangePreset(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(Date.now() - (days - 1) * 86400000);
  const s = (d: Date) => d.toISOString().slice(0, 10);
  return { from: s(from), to: s(to) };
}

export default function Reports() {
  const [preset, setPreset] = useState<"7" | "30" | "custom">("7");
  const [custom, setCustom] = useState(rangePreset(30));
  const range = useMemo(() => (preset === "custom" ? custom : rangePreset(Number(preset))), [preset, custom]);

  const sales = trpc.reports.salesSummary.useQuery(range);
  const top = trpc.reports.topProducts.useQuery({ ...range, limit: 10 });
  const profit = trpc.reports.basicProfit.useQuery(range);
  const recv = trpc.reports.receivablesSummary.useQuery();

  const maxDaily = Math.max(1, ...(sales.data?.daily ?? []).map(d => d.total));

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-gray-800">Laporan</h2>
        <NativeSelect className="ml-auto max-w-[150px]" value={preset} onChange={(e) => setPreset(e.target.value as typeof preset)}>
          <option value="7">7 hari</option>
          <option value="30">30 hari</option>
          <option value="custom">Rentang kustom</option>
        </NativeSelect>
        {preset === "custom" && (
          <>
            <Input type="date" className="w-36" value={custom.from} onChange={(e) => setCustom(c => ({ ...c, from: e.target.value }))} />
            <Input type="date" className="w-36" value={custom.to} onChange={(e) => setCustom(c => ({ ...c, to: e.target.value }))} />
          </>
        )}
      </div>

      {sales.isLoading ? <Spinner /> : sales.data && (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat title="Total penjualan" value={formatRupiah(sales.data.totalSales)} />
            <Stat title="Jumlah transaksi" value={String(sales.data.trxCount)} />
            <Stat title="Total diskon" value={formatRupiah(sales.data.totalDiscount)} />
            <Stat title="Piutang berjalan" value={formatRupiah(recv.data?.outstanding ?? 0)}
              sub={`${recv.data?.openCount ?? 0} belum lunas · ${recv.data?.overdueCount ?? 0} jatuh tempo`} />
          </div>

          <Card>
            <CardHeader title="Penjualan harian" />
            <div className="flex h-40 items-end gap-1 overflow-x-auto p-4">
              {sales.data.daily.length === 0 && <p className="text-xs text-gray-400">Tidak ada data pada rentang ini.</p>}
              {sales.data.daily.map(d => (
                <div key={d.day} className="flex min-w-[28px] flex-1 flex-col items-center gap-1" title={`${d.day}: ${formatRupiah(d.total)}`}>
                  <div className={cn("w-full rounded-t", d.total > 0 ? "bg-brand-500" : "bg-warm-100")}
                    style={{ height: `${Math.max(3, (d.total / maxDaily) * 100)}px` }} />
                  <span className="rotate-0 text-[9px] text-gray-400">{d.day.slice(5)}</span>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Metode pembayaran" />
              <table className="w-full text-sm">
                <tbody className="divide-y divide-warm-100">
                  {sales.data.byMethod.map(m => (
                    <tr key={m.method}>
                      <td className="px-4 py-2 uppercase">{m.method}</td>
                      <td className="px-4 py-2 text-right">{m.count} trx</td>
                      <td className="px-4 py-2 text-right font-semibold">{formatRupiah(m.total)}</td>
                    </tr>
                  ))}
                  {!sales.data.byMethod.length && <tr><td colSpan={3} className="px-4 py-3 text-xs text-gray-400">Belum ada transaksi.</td></tr>}
                </tbody>
              </table>
            </Card>

            <Card>
              <CardHeader title="Produk terlaris" />
              <table className="w-full text-sm">
                <tbody className="divide-y divide-warm-100">
                  {(top.data ?? []).map((t, i) => (
                    <tr key={`${t.productId}-${i}`}>
                      <td className="px-4 py-2">{i + 1}. <span className="font-medium">{t.name}</span></td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">{t.qtySold} pcs</td>
                      <td className="px-4 py-2 text-right font-semibold">{formatRupiah(t.revenue)}</td>
                    </tr>
                  ))}
                  {!top.isLoading && !(top.data ?? []).length && <tr><td colSpan={3} className="px-4 py-3 text-xs text-gray-400">Belum ada penjualan.</td></tr>}
                </tbody>
              </table>
            </Card>
          </div>

          {profit.data && (
            <Card>
              <CardHeader title="Laba dasar"
                subtitle={profit.data.hasMissingCost
                  ? "Sebagian produk belum punya harga modal — angka laba bisa lebih tinggi dari kenyataan."
                  : undefined}
                action={profit.data.hasMissingCost ? <Badge tone="amber">data modal belum lengkap</Badge> : undefined} />
              <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
                <Stat title="Omzet" value={formatRupiah(profit.data.revenue)} />
                <Stat title="HPP (modal)" value={formatRupiah(profit.data.cogs)} />
                <Stat title="Laba kotor" value={formatRupiah(profit.data.grossProfit)} tone="brand" />
                <Stat title={`Estimasi bersih${profit.data.hasMissingCost ? "*" : ""}`}
                  value={formatRupiah(profit.data.netEstimate)}
                  sub={`lain masuk ${formatRupiah(profit.data.otherIncome)} · keluar ${formatRupiah(profit.data.expense)}`} />
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ title, value, sub, tone }: { title: string; value: string; sub?: string; tone?: "brand" }) {
  return (
    <Card className="p-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{title}</p>
      <p className={cn("mt-0.5 truncate text-lg font-bold", tone === "brand" ? "text-brand-700" : "text-gray-900")}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-gray-400">{sub}</p>}
    </Card>
  );
}

