import { useState } from "react";
import { trpc } from "../lib/trpc.js";
import { formatRupiah } from "@shared/money.js";
import {
  Button, Card, CardHeader, NativeSelect, Badge, Spinner, Modal,
  EmptyState, toast, formatDateTime, Label, Input, cn
} from "../components/ui.js";
import { Boxes, SlidersHorizontal, AlertTriangle, Plus, Calendar } from "lucide-react";

const TYPE_TONE: Record<string, "green" | "red" | "amber" | "blue"> = {
  purchase: "green", sale: "red", opname: "amber", adjustment: "blue", transfer_out: "amber",
};

export default function Inventory() {
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [expiryOpen, setExpiryOpen] = useState(false);

  const movements = trpc.inventory.movements.useQuery({
    type: (type || undefined) as "purchase" | "sale" | "opname" | "adjustment" | undefined,
    from: from || undefined,
    to: to || undefined,
    limit: 100,
  });

  const expiryAlertsQ = trpc.analytics.expiryAlerts.useQuery({ daysThreshold: 60 });
  const expiringCount = expiryAlertsQ.data?.length ?? 0;

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-gray-800">Mutasi Stok & Kadaluarsa</h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className={cn(expiringCount > 0 && "border-amber-300 bg-amber-50 text-amber-900")}
            onClick={() => setExpiryOpen(true)}
          >
            <AlertTriangle size={15} className={expiringCount > 0 ? "text-amber-600" : "text-gray-400"} />
            Batch Kadaluarsa
            {expiringCount > 0 && <Badge tone="amber" className="ml-1">{expiringCount}</Badge>}
          </Button>

          <Button variant="outline" onClick={() => setAdjustOpen(true)}>
            <SlidersHorizontal size={15} /> Penyesuaian
          </Button>

          <NativeSelect className="max-w-[150px]" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Semua tipe</option>
            <option value="purchase">Pembelian</option>
            <option value="sale">Penjualan</option>
            <option value="opname">Opname</option>
            <option value="adjustment">Penyesuaian</option>
          </NativeSelect>
          <Input type="date" className="w-36" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Dari tanggal" />
          <Input type="date" className="w-36" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Sampai tanggal" />
        </div>
      </div>

      {movements.isLoading ? <Spinner /> : !movements.data?.length ? (
        <Card><EmptyState icon={<Boxes size={28} />} title="Belum ada mutasi stok" /></Card>
      ) : (
        <Card>
          <CardHeader title="Riwayat Mutasi" subtitle={`${movements.data.length} entri terakhir`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-warm-100 text-left text-[11px] uppercase text-gray-500">
                  <th className="px-4 py-2">Waktu</th>
                  <th className="px-4 py-2">Produk</th>
                  <th className="px-4 py-2">Tipe</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-100">
                {movements.data.map(m => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-500">{formatDateTime(m.createdAt)}</td>
                    <td className="px-4 py-2">{m.productName} <span className="text-gray-400">{m.variantLabel ?? ""}</span></td>
                    <td className="px-4 py-2"><Badge tone={TYPE_TONE[m.type] || "neutral"}>{m.type}</Badge></td>
                    <td className={"px-4 py-2 text-right font-bold " + (m.qty >= 0 ? "text-green-700" : "text-red-600")}>
                      {m.qty > 0 ? `+${m.qty}` : m.qty}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-2 text-xs text-gray-500">{m.note ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {adjustOpen && (
        <AdjustModal onClose={(changed) => {
          setAdjustOpen(false);
          if (changed) void movements.refetch();
        }} />
      )}

      {expiryOpen && (
        <ExpiryModal
          onClose={() => {
            setExpiryOpen(false);
            void expiryAlertsQ.refetch();
          }}
        />
      )}
    </div>
  );
}

function AdjustModal({ onClose }: { onClose: (changed: boolean) => void }) {
  const [pickQ, setPickQ] = useState("");
  const pick = trpc.inventory.variantsForPick.useQuery({ q: pickQ.length >= 2 ? pickQ : undefined, limit: 8 });
  const adjust = trpc.inventory.adjustStock.useMutation({
    onSuccess: () => { toast("Stok disesuaikan"); onClose(true); },
    onError: (e) => toast(e.message, "err"),
  });
  const [variantId, setVariantId] = useState(0);
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("");

  return (
    <Modal open onClose={() => onClose(false)} title="Penyesuaian stok manual">
      <div className="space-y-3">
        <div>
          <Label>Cari varian</Label>
          <Input value={pickQ} onChange={(e) => { setPickQ(e.target.value); setVariantId(0); }} placeholder="nama/barcode…" />
          {pick.data && pickQ.length >= 2 && variantId === 0 && (
            <ul className="mt-1 max-h-32 divide-y divide-warm-100 overflow-y-auto rounded border border-warm-200">
              {pick.data.map(v => (
                <li key={v.variantId}>
                  <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-warm-100"
                    onClick={() => { setVariantId(v.variantId); setPickQ(`${v.name} — ${v.label}`); }}>
                    {v.name} — {v.label} <span className="float-right text-xs">stok {v.stock}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div><Label>Perubahan (+/-) *</Label>
          <Input value={delta || ""} onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9-]/g, "");
            setDelta(raw === "" || raw === "-" ? 0 : parseInt(raw, 10));
          }} placeholder="mis. -2 atau 5" /></div>
        <div><Label>Alasan *</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="rusak, hilang, hadiah…" /></div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onClose(false)}>Batal</Button>
          <Button disabled={!variantId || delta === 0 || reason.trim().length < 3 || adjust.isPending}
            onClick={() => adjust.mutate({ variantId, deltaQty: delta, reason: reason.trim() })}>
            Simpan
          </Button>
        </div>
      </div>
    </Modal>
  );
}

type ExpiryAlertItem = {
  id: number;
  batchNo: string;
  expiryDate: string;
  qty: number;
  costPrice: number;
  variantId: number;
  variantLabel: string;
  productName: string;
  sellingPrice: number;
  isExpired: boolean;
  daysLeft: number;
};

function ExpiryModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"alerts" | "add">("alerts");
  const alertsQ = trpc.analytics.expiryAlerts.useQuery({ daysThreshold: 60 });
  const [pickQ, setPickQ] = useState("");
  const pick = trpc.inventory.variantsForPick.useQuery({ q: pickQ.length >= 2 ? pickQ : undefined, limit: 8 });
  const [variantId, setVariantId] = useState(0);
  const [batchNo, setBatchNo] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [qty, setQty] = useState(10);
  const [costPrice, setCostPrice] = useState(0);

  const addBatchMut = trpc.analytics.addBatch.useMutation({
    onSuccess: () => {
      toast("Batch produk berhasil dicatat");
      setTab("alerts");
      setBatchNo("");
      setExpiryDate("");
      void alertsQ.refetch();
    },
    onError: (e: { message: string }) => toast(e.message, "err"),
  });

  return (
    <Modal open onClose={onClose} title="Pelacakan Batch & Tanggal Kadaluarsa" wide>
      <div className="space-y-4 text-xs">
        <div className="flex gap-1 rounded-lg border border-warm-200 bg-warm-100 p-0.5">
          <button
            type="button"
            className={cn("flex-1 rounded py-1.5 font-semibold", tab === "alerts" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500")}
            onClick={() => setTab("alerts")}
          >
            Peringatan Kadaluarsa (60 Hari ke Depan)
          </button>
          <button
            type="button"
            className={cn("flex-1 rounded py-1.5 font-semibold", tab === "add" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500")}
            onClick={() => setTab("add")}
          >
            + Catat Batch Baru
          </button>
        </div>

        {tab === "alerts" ? (
          <div>
            {alertsQ.isLoading ? <Spinner /> :
             !alertsQ.data?.length ? (
              <EmptyState icon={<Calendar size={28} />} title="Semua batch produk dalam kondisi aman" description="Tidak ada produk yang mendekati tanggal kadaluarsa dalam 60 hari ke depan." />
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {(alertsQ.data as ExpiryAlertItem[]).map((b: ExpiryAlertItem) => (
                  <div key={b.id} className={cn(
                    "flex items-center justify-between rounded-lg border p-3",
                    b.isExpired ? "border-red-300 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"
                  )}>
                    <div>
                      <p className="font-semibold text-sm">{b.productName} ({b.variantLabel})</p>
                      <p className="text-[11px]">
                        Batch: <span className="font-mono font-bold">{b.batchNo}</span> · Qty: {b.qty} pcs
                      </p>
                      <p className="text-[11px] font-medium">
                        Kadaluarsa: <b>{b.expiryDate}</b> ({b.isExpired ? "SUDAH KADALUARSA" : `${b.daysLeft} hari lagi`})
                      </p>
                    </div>
                    <Badge tone={b.isExpired ? "red" : "amber"}>
                      {b.isExpired ? "Kadaluarsa" : `${b.daysLeft} Hari`}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Cari Produk / Varian *</Label>
              <Input
                value={pickQ}
                onChange={(e) => { setPickQ(e.target.value); setVariantId(0); }}
                placeholder="Ketik nama produk…"
              />
              {pick.data && pickQ.length >= 2 && variantId === 0 && (
                <ul className="mt-1 max-h-32 divide-y divide-warm-100 overflow-y-auto rounded border border-warm-200 bg-white">
                  {pick.data.map(v => (
                    <li key={v.variantId}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-warm-100"
                        onClick={() => {
                          setVariantId(v.variantId);
                          setPickQ(`${v.name} — ${v.label}`);
                        }}
                      >
                        <span className="font-semibold">{v.name}</span> ({v.label})
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Nomor Batch / Lot *</Label>
                <Input value={batchNo} onChange={(e) => setBatchNo(e.target.value)} placeholder="Contoh: LOT-2026-A" />
              </div>
              <div>
                <Label>Tanggal Kadaluarsa *</Label>
                <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Kuantitas (Pcs) *</Label>
                <Input
                  inputMode="numeric"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value.replace(/\D/g, "")) || 0)}
                />
              </div>
              <div>
                <Label>Harga Modal/Pcs</Label>
                <Input
                  inputMode="numeric"
                  value={costPrice || ""}
                  onChange={(e) => setCostPrice(Number(e.target.value.replace(/\D/g, "")) || 0)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setTab("alerts")}>Batal</Button>
              <Button
                disabled={!variantId || !batchNo.trim() || !expiryDate || qty <= 0 || addBatchMut.isPending}
                onClick={() => addBatchMut.mutate({ variantId, batchNo, expiryDate, qty, costPrice })}
              >
                Simpan Batch
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
