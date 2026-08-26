import { useState } from "react";
import { trpc } from "../lib/trpc.js";
import { Button, Card, CardHeader, NativeSelect, Badge, Spinner, Modal, EmptyState, toast, formatDateTime, Label, Input } from "../components/ui.js";
import { Boxes, SlidersHorizontal } from "lucide-react";

const TYPE_TONE: Record<string, "green" | "red" | "amber" | "blue"> = {
  purchase: "green", sale: "red", opname: "amber", adjustment: "blue",
};

export default function Inventory() {
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const movements = trpc.inventory.movements.useQuery({
    type: (type || undefined) as "purchase" | "sale" | "opname" | "adjustment" | undefined,
    from: from || undefined,
    to: to || undefined,
    limit: 100,
  });
  const [adjustOpen, setAdjustOpen] = useState(false);

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-gray-800">Mutasi Stok</h2>
        <NativeSelect className="ml-auto max-w-[150px]" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Semua tipe</option>
          <option value="purchase">Pembelian</option>
          <option value="sale">Penjualan</option>
          <option value="opname">Opname</option>
          <option value="adjustment">Penyesuaian</option>
        </NativeSelect>
        <Input type="date" className="w-36" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Dari tanggal" />
        <Input type="date" className="w-36" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Sampai tanggal" />
        <Button variant="outline" onClick={() => setAdjustOpen(true)}><SlidersHorizontal size={15} /> Penyesuaian</Button>
      </div>

      {movements.isLoading ? <Spinner /> : !movements.data?.length ? (
        <Card><EmptyState icon={<Boxes size={28} />} title="Belum ada mutasi stok" /></Card>
      ) : (
        <Card>
          <CardHeader title="Riwayat" subtitle={`${movements.data.length} entri terakhir`} />
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
                    <td className="px-4 py-2"><Badge tone={TYPE_TONE[m.type]}>{m.type}</Badge></td>
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
