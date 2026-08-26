import { useState } from "react";
import { trpc } from "../lib/trpc.js";
import { Button, Card, Input, Label, Badge, Spinner, Modal, EmptyState, toast, formatDate } from "../components/ui.js";
import { Plus, ClipboardCheck, Ban, CheckCircle2 } from "lucide-react";

export default function Opname() {
  const utils = trpc.useUtils();
  const list = trpc.inventory.opnameList.useQuery();
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <div className="space-y-4 p-4">
      <OpnameCreate onCreated={(id) => setOpenId(id)} />
      <Card>
        {list.isLoading ? <Spinner /> : !list.data?.length ? (
          <EmptyState icon={<ClipboardCheck size={28} />} title="Belum ada sesi stok opname" description="Mulai sesi untuk mencocokkan stok fisik dengan sistem." />
        ) : (
          <ul className="divide-y divide-warm-100">
            {list.data.map(o => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 p-3.5">
                <div className="min-w-[180px] flex-1">
                  <p className="text-sm font-semibold">{o.code}</p>
                  <p className="text-xs text-gray-500">{formatDate(o.createdAt)} · {o.responsibleName} · {Number(o.itemCount)} item</p>
                </div>
                <Badge tone={o.status === "open" ? "amber" : o.status === "finalized" ? "green" : "neutral"}>{o.status}</Badge>
                <Button variant="outline" size="sm" onClick={() => setOpenId(o.id)}>Buka</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {openId !== null && (
        <OpnameDetail id={openId} onClose={(changed) => {
          setOpenId(null);
          if (changed) void utils.inventory.opnameList.invalidate();
        }} />
      )}
    </div>
  );
}

function OpnameCreate({ onCreated }: { onCreated: (id: number) => void }) {
  const create = trpc.inventory.opnameCreate.useMutation({
    onSuccess: (r) => { toast(`Sesi ${r.code} dibuat`); onCreated(r.id); },
    onError: (e) => toast(e.message, "err"),
  });
  const [name, setName] = useState("");
  return (
    <div className="flex items-end gap-2">
      <div className="max-w-xs flex-1">
        <Label>Nama penanggung jawab sesi baru</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Budi" />
      </div>
      <Button disabled={!name.trim() || create.isPending}
        onClick={() => create.mutate({ responsibleName: name.trim(), note: null })}>
        <Plus size={15} /> Mulai sesi
      </Button>
    </div>
  );
}

function OpnameDetail({ id, onClose }: { id: number; onClose: (changed: boolean) => void }) {
  const utils = trpc.useUtils();
  const detail = trpc.inventory.opnameGet.useQuery({ id });
  const [adding, setAdding] = useState(false);
  const finalize = trpc.inventory.opnameFinalize.useMutation({
    onSuccess: () => { toast("Sesi difinalisasi, selisih diterapkan"); void utils.inventory.opnameList.invalidate(); onClose(true); },
    onError: (e) => toast(e.message, "err"),
  });
  const cancel = trpc.inventory.opnameCancel.useMutation({
    onSuccess: () => { toast("Sesi dibatalkan"); void utils.inventory.opnameList.invalidate(); onClose(false); },
    onError: (e) => toast(e.message, "err"),
  });

  if (detail.isLoading) return <Modal open onClose={() => onClose(false)} title="Memuat…"><Spinner /></Modal>;
  if (!detail.data) return null;
  const d = detail.data;

  return (
    <Modal open onClose={() => onClose(false)} title={`Sesi ${d.code}`} wide>
      <div className="space-y-3">
        <p className="text-xs text-gray-500">{d.responsibleName} · status <Badge tone={d.status === "open" ? "amber" : "green"}>{d.status}</Badge></p>

        {d.items.length === 0 && <EmptyState title="Belum ada item dihitung" description="Tambahkan varian dan hitung stok fisiknya." />}

        {d.items.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-warm-200">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-warm-100 bg-warm-25 text-left text-[11px] uppercase text-gray-500">
                  <th className="px-3 py-2">Produk</th>
                  <th className="px-3 py-2 text-right">Sistem</th>
                  <th className="px-3 py-2 text-right">Fisik</th>
                  <th className="px-3 py-2 text-right">Selisih</th>
                  <th className="px-3 py-2">Alasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-100">
                {d.items.map(it => (
                  <tr key={it.id}>
                    <td className="px-3 py-2">{it.productName} <span className="text-gray-400">{it.variantLabel}</span></td>
                    <td className="px-3 py-2 text-right">{it.systemStock}</td>
                    <td className="px-3 py-2 text-right">{it.physicalStock}</td>
                    <td className={"px-3 py-2 text-right font-bold " + (it.diff === 0 ? "text-gray-400" : it.diff > 0 ? "text-green-700" : "text-red-600")}>
                      {it.diff > 0 ? `+${it.diff}` : it.diff}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{it.reason ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {d.status === "open" && (
            <>
              <Button variant="ghost" className="text-red-600" onClick={() => { if (confirm("Batalkan sesi?")) cancel.mutate({ opnameId: id }); }}>
                <Ban size={14} /> Batalkan
              </Button>
              <Button variant="outline" onClick={() => setAdding(true)}><Plus size={14} /> Tambah item</Button>
              <Button disabled={!d.items.length || finalize.isPending} onClick={() => {
                if (confirm("Finalisasi akan menyesuaikan stok sistem sesuai fisik. Lanjutkan?")) finalize.mutate({ opnameId: id });
              }}>
                <CheckCircle2 size={15} /> Finalisasi
              </Button>
            </>
          )}
          {d.status !== "open" && <Button variant="outline" onClick={() => onClose(false)}>Tutup</Button>}
        </div>
      </div>

      {adding && (
        <AddItemInline opnameId={id} onClose={(c) => {
          setAdding(false);
          if (c) void detail.refetch();
        }} />
      )}
    </Modal>
  );
}

function AddItemInline({ opnameId, onClose }: { opnameId: number; onClose: (changed: boolean) => void }) {
  const [pickQ, setPickQ] = useState("");
  const pick = trpc.inventory.variantsForPick.useQuery({ q: pickQ.length >= 2 ? pickQ : undefined, limit: 8 });
  const addItem = trpc.inventory.opnameAddItem.useMutation({
    onSuccess: () => { toast("Item ditambahkan"); onClose(true); },
    onError: (e) => toast(e.message, "err"),
  });
  const [variantId, setVariantId] = useState(0);
  const [physical, setPhysical] = useState(0);
  const [reason, setReason] = useState("");

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-brand-200 bg-brand-50/40 p-3">
      <Label>Cari & pilih varian</Label>
      <Input value={pickQ} onChange={(e) => setPickQ(e.target.value)} placeholder="nama/barcode…" />
      {pick.data && variantId === 0 && (
        <ul className="max-h-28 divide-y divide-warm-100 overflow-y-auto rounded border border-warm-200 bg-white">
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
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Stok fisik *</Label><Input inputMode="numeric" value={physical || ""} onChange={(e) => setPhysical(Number(e.target.value.replace(/\D/g, "")) || 0)} /></div>
        <div><Label>Alasan bila selisih</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="rusak/hilang/lain" /></div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => onClose(false)}>Batal</Button>
        <Button size="sm" disabled={!variantId || addItem.isPending} onClick={() => addItem.mutate({ opnameId, variantId, physicalStock: physical, reason: reason.trim() || null })}>Tambah</Button>
      </div>
    </div>
  );
}
