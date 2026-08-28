import { useState } from "react";
import { trpc } from "../lib/trpc.js";
import { formatRupiah } from "@shared/money.js";
import { Button, Card, Input, Label, NativeSelect, Badge, Spinner, Modal, EmptyState, toast, formatDate, cn } from "../components/ui.js";
import { Plus, PackageCheck, Sparkles, TrendingUp, AlertTriangle } from "lucide-react";

const STATUS_TONE: Record<string, "neutral" | "green" | "amber" | "blue" | "red"> = {
  ordered: "blue", partial: "amber", received: "green", cancelled: "red", draft: "neutral",
};

export default function Purchases() {
  const [creating, setCreating] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [prefilledItems, setPrefilledItems] = useState<ItemRow[] | null>(null);
  const utils = trpc.useUtils();
  const list = trpc.purchases.list.useQuery({ limit: 50 });
  const reorderQ = trpc.purchases.reorderRecommendations.useQuery();

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-gray-800">Pembelian ke Pemasok</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setReorderOpen(true)}
            className="border-brand-300 bg-brand-50 text-brand-800 hover:bg-brand-100"
          >
            <Sparkles size={16} /> Saran Reorder
            {reorderQ.data && reorderQ.data.length > 0 && (
              <Badge tone="amber" className="ml-1">{reorderQ.data.length}</Badge>
            )}
          </Button>
          <Button onClick={() => { setPrefilledItems(null); setCreating(true); }}>
            <Plus size={16} /> Pembelian baru
          </Button>
        </div>
      </div>

      {list.isLoading ? <Spinner /> : !list.data?.items.length ? (
        <Card><EmptyState icon={<PackageCheck size={28} />} title="Belum ada pembelian" /></Card>
      ) : (
        <div className="space-y-2">
          {list.data.items.map(p => (
            <Card key={p.id} className="flex flex-wrap items-center gap-3 p-3.5">
              <div className="min-w-[180px] flex-1">
                <p className="text-sm font-semibold text-gray-800">{p.invoiceNo}</p>
                <p className="text-xs text-gray-500">{p.supplierName} · {formatDate(p.createdAt)}</p>
              </div>
              <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
              <span className="text-sm font-bold">{formatRupiah(p.totalCost)}</span>
              <Button variant="outline" size="sm" onClick={() => setDetailId(p.id)}>Detail / Terima</Button>
            </Card>
          ))}
        </div>
      )}

      {creating && (
        <PurchaseCreateModal
          initialItems={prefilledItems ?? []}
          onClose={(c) => {
            setCreating(false);
            setPrefilledItems(null);
            if (c) void utils.purchases.list.invalidate();
          }}
        />
      )}

      {detailId !== null && <PurchaseReceiveModal id={detailId} onClose={(c) => {
        setDetailId(null);
        if (c) void utils.purchases.list.invalidate();
      }} />}

      {/* Smart Reorder Modal */}
      <Modal open={reorderOpen} onClose={() => setReorderOpen(false)} title="Rekomendasi Reorder Stok Otomatis" wide>
        <div className="space-y-3">
          <p className="text-xs text-gray-600">
            Dianalisis berdasarkan kecepatan penjualan 7 hari terakhir (*sales velocity*) dan batas stok minimum.
          </p>

          {reorderQ.isLoading ? <Spinner /> :
           !reorderQ.data?.length ? (
            <EmptyState icon={<Sparkles size={28} />} title="Stok semua produk dalam kondisi aman" description="Tidak ada item yang menipis atau memerlukan pemesanan darurat saat ini." />
          ) : (
            <div className="space-y-2">
              <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {reorderQ.data.map(r => (
                  <div key={r.variantId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warm-200 bg-white p-3 shadow-sm">
                    <div className="min-w-[180px] flex-1">
                      <p className="font-semibold text-gray-800">{r.productName} — {r.variantLabel}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <AlertTriangle size={13} className="text-amber-600" /> Sisa stok: <b>{r.stock}</b> (min: {r.minStock})
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp size={13} className="text-brand-600" /> Laju: <b>{r.dailyVelocity} pcs/hari</b>
                        </span>
                        <span>Estimasi habis: <b>{r.daysRemaining > 90 ? "Stok mati" : `${r.daysRemaining} hari`}</b></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Saran order</p>
                        <p className="text-sm font-bold text-brand-700">{r.suggestedQty} pcs</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setReorderOpen(false)}>Tutup</Button>
                <Button onClick={() => {
                  const autoItems: ItemRow[] = (reorderQ.data ?? []).map(r => ({
                    variantId: r.variantId,
                    nameText: `${r.productName} — ${r.variantLabel}`,
                    qtyOrdered: r.suggestedQty,
                    unitCost: r.costPrice > 0 ? r.costPrice : Math.round(r.costPrice * 0.7),
                  }));
                  setPrefilledItems(autoItems);
                  setReorderOpen(false);
                  setCreating(true);
                }}>
                  <Plus size={16} /> Buat PO dari {reorderQ.data.length} Item Ini
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

type ItemRow = { variantId: number; nameText: string; qtyOrdered: number; unitCost: number };

function PurchaseCreateModal({ initialItems, onClose }: { initialItems: ItemRow[]; onClose: (changed: boolean) => void }) {
  const suppliersQ = trpc.suppliers.list.useQuery({});
  const create = trpc.purchases.create.useMutation({
    onSuccess: () => { toast("Pembelian dibuat"); onClose(true); },
    onError: (e) => toast(e.message, "err"),
  });

  const [supplierId, setSupplierId] = useState(0);
  const [invoiceNo, setInvoiceNo] = useState(`PO-${Date.now() % 100000}`);
  const [items, setItems] = useState<ItemRow[]>(initialItems ?? []);
  const [pickQ, setPickQ] = useState("");
  const pickQ2 = trpc.inventory.variantsForPick.useQuery({ q: pickQ.length >= 2 ? pickQ : undefined, limit: 8 }, { enabled: true });
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    setErr(null);
    if (!supplierId) return setErr("Pilih pemasok");
    if (!items.length) return setErr("Tambahkan minimal satu item");
    create.mutate({
      supplierId,
      invoiceNo,
      items: items.map(i => ({ variantId: i.variantId, qtyOrdered: i.qtyOrdered, unitCost: i.unitCost })),
    });
  }

  const total = items.reduce((s, i) => s + i.qtyOrdered * i.unitCost, 0);

  return (
    <Modal open onClose={() => onClose(false)} title="Pembelian baru" wide>
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <Label>Pemasok *</Label>
            <NativeSelect value={supplierId} onChange={(e) => setSupplierId(Number(e.target.value))}>
              <option value={0}>— pilih —</option>
              {suppliersQ.data?.items.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </NativeSelect>
          </div>
          <div><Label>No. Invoice *</Label><Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} /></div>
        </div>

        <div>
          <Label>Tambah item</Label>
          <Input placeholder="Cari produk/varian…" value={pickQ} onChange={(e) => setPickQ(e.target.value)} />
          {pickQ.length >= 2 && pickQ2.data && (
            <ul className="mt-1 max-h-36 divide-y divide-warm-100 overflow-y-auto rounded-lg border border-warm-200">
              {pickQ2.data.map(v => (
                <li key={v.variantId}>
                  <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-warm-100"
                    onClick={() => {
                      if (items.some(i => i.variantId === v.variantId)) { toast("Sudah ada di daftar", "err"); return; }
                      setItems(a => [...a, { variantId: v.variantId, nameText: `${v.name} — ${v.label}`, qtyOrdered: 1, unitCost: v.sellingPrice ? Math.round(v.sellingPrice * 0.7) : 1000 }]);
                      setPickQ("");
                    }}>
                    <span className="font-medium">{v.name}</span> <span className="text-gray-500">{v.label}</span>
                    <span className="float-right text-xs text-brand-700">stok {v.stock}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={it.variantId} className="rounded-lg border border-warm-200 p-2">
                <div className="flex items-center justify-between">
                  <p className="truncate pr-2 text-sm font-medium">{it.nameText}</p>
                  <button className="text-xs text-red-600" onClick={() => setItems(a => a.filter((_, xi) => xi !== i))}>hapus</button>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <div><Label>Qty pesan</Label>
                    <Input inputMode="numeric" value={it.qtyOrdered || ""} onChange={(e) => setItems(a => a.map((x, xi) => xi === i ? { ...x, qtyOrdered: Number(e.target.value.replace(/\D/g, "")) || 0 } : x))} />
                  </div>
                  <div><Label>Harga beli/unit</Label>
                    <Input inputMode="numeric" value={it.unitCost || ""} onChange={(e) => setItems(a => a.map((x, xi) => xi === i ? { ...x, unitCost: Number(e.target.value.replace(/\D/g, "")) || 0 } : x))} />
                  </div>
                </div>
              </div>
            ))}
            <p className="text-right text-sm font-bold">Total: {formatRupiah(total)}</p>
          </div>
        )}

        {err && <p className="text-xs text-red-600">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onClose(false)}>Batal</Button>
          <Button onClick={submit} disabled={create.isPending}>Simpan</Button>
        </div>
      </div>
    </Modal>
  );
}

function PurchaseReceiveModal({ id, onClose }: { id: number; onClose: (changed: boolean) => void }) {
  const detail = trpc.purchases.get.useQuery({ id });
  const receive = trpc.purchases.receive.useMutation({
    onSuccess: (r) => { toast(r.status === "received" ? "Pembelian diterima penuh" : "Diterima sebagian"); onClose(true); },
    onError: (e) => toast(e.message, "err"),
  });
  const [qtys, setQtys] = useState<Record<number, string>>({});
  const [loaded, setLoaded] = useState(false);

  if (detail.data && !loaded) {
    const init: Record<number, string> = {};
    for (const it of detail.data.items) init[it.id] = String(it.qtyOrdered - it.qtyReceived);
    setQtys(init);
    setLoaded(true);
  }

  if (detail.isLoading) return <Modal open onClose={() => onClose(false)} title="Memuat…"><Spinner /></Modal>;
  if (!detail.data) return null;
  const d = detail.data;
  const allReceived = d.items.every(i => i.qtyReceived >= i.qtyOrdered);

  function submit() {
    const receipts = d.items
      .map(it => ({ itemId: it.id, receiveQty: Number(qtys[it.id] ?? "0") || 0 }))
      .filter(r => r.receiveQty > 0);

    if (!receipts.length) {
      toast("Masukkan kuantitas terima minimal 1 pada salah satu item", "err");
      return;
    }

    receive.mutate({
      purchaseId: id,
      receipts,
    });
  }

  return (
    <Modal open onClose={() => onClose(false)} title={`Terima barang — ${d.invoiceNo}`} wide>
      <div className="space-y-2">
        <p className="text-xs text-gray-500">{d.supplierName} · status <Badge tone={STATUS_TONE[d.status]}>{d.status}</Badge></p>
        {allReceived && <p className="rounded bg-green-50 p-2 text-xs text-green-700">Semua item sudah diterima.</p>}
        {!allReceived && d.items.map(it => {
          const remaining = it.qtyOrdered - it.qtyReceived;
          return (
            <div key={it.id} className="flex items-center justify-between gap-3 rounded-lg border border-warm-200 p-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{it.productName}</p>
                <p className="text-[11px] text-gray-500">{it.variantLabel} · pesan {it.qtyOrdered}, terima {it.qtyReceived}</p>
              </div>
              <div className="w-24 shrink-0">
                <Label>Terima</Label>
                <Input inputMode="numeric" disabled={remaining <= 0}
                  className={cn(remaining <= 0 && "opacity-40")}
                  value={qtys[it.id] ?? ""}
                  onChange={(e) => setQtys(q => ({ ...q, [it.id]: e.target.value.replace(/\D/g, "") }))} />
              </div>
            </div>
          );
        })}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => onClose(false)}>Tutup</Button>
          {!allReceived && <Button onClick={submit} disabled={receive.isPending}>Konfirmasi penerimaan</Button>}
        </div>
      </div>
    </Modal>
  );
}
