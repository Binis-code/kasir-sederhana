import { useState } from "react";
import { trpc } from "../lib/trpc.js";
import {
  Button, Card, CardHeader, Input, Label, NativeSelect, Badge, Spinner, Modal,
  EmptyState, toast, formatDateTime, cn
} from "../components/ui.js";
import { Store, ArrowRightLeft, Plus, CheckCircle, Truck, Package } from "lucide-react";

type OutletItem = {
  id: number;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  isMain: boolean;
  isActive: boolean;
};

type TransferItem = {
  id: number;
  transferNo: string;
  fromOutletId: number;
  toOutletId: number;
  status: "pending" | "in_transit" | "completed" | "cancelled" | string;
  notes?: string | null;
  createdAt: string | Date;
  fromOutletName: string;
  toOutletName: string;
};

export default function OutletsPage({ role }: { role?: string }) {
  const isAdmin = role === "owner" || role === "admin";
  const utils = trpc.useUtils();

  const outletsQ = trpc.outlets.list.useQuery();
  const transfersQ = trpc.outlets.listTransfers.useQuery();

  const [createOutletModal, setCreateOutletModal] = useState(false);
  const [createTransferModal, setCreateTransferModal] = useState(false);

  // Outlet form
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const createOutletMut = trpc.outlets.create.useMutation({
    onSuccess: () => {
      toast("Cabang baru berhasil dibuat");
      setCreateOutletModal(false);
      setName(""); setCode(""); setAddress(""); setPhone("");
      void outletsQ.refetch();
    },
    onError: (e: { message: string }) => toast(e.message, "err"),
  });

  const updateTransferStatusMut = trpc.outlets.updateStatus.useMutation({
    onSuccess: () => {
      toast("Status transfer berhasil diperbarui");
      void transfersQ.refetch();
    },
    onError: (e: { message: string }) => toast(e.message, "err"),
  });

  return (
    <div className="space-y-6 p-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900">Manajemen Multi-Cabang & Transfer Stok</h2>
          <p className="text-xs text-gray-500">Kelola outlet/cabang terpisah dan mutasi kirim barang antar-gudang</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setCreateOutletModal(true)}>
              <Plus size={16} /> Tambah Cabang
            </Button>
          )}
          <Button onClick={() => setCreateTransferModal(true)}>
            <ArrowRightLeft size={16} /> Transfer Stok Baru
          </Button>
        </div>
      </div>

      {/* Outlets Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {outletsQ.isLoading ? <Spinner /> :
         (outletsQ.data as OutletItem[] | undefined)?.map((o: OutletItem) => (
          <Card key={o.id} className="p-4 shadow-xs">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 font-bold text-brand-700">
                  <Store size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{o.name}</p>
                  <p className="text-[11px] font-mono text-gray-500">Kode: {o.code}</p>
                </div>
              </div>
              {o.isMain && <Badge tone="green">Pusat</Badge>}
            </div>
            <div className="mt-3 space-y-0.5 border-t border-warm-100 pt-2 text-xs text-gray-500">
              {o.address && <p className="truncate">📍 {o.address}</p>}
              {o.phone && <p>📞 {o.phone}</p>}
            </div>
          </Card>
        ))}
      </div>

      {/* Stock Transfers History */}
      <Card>
        <CardHeader
          title="Riwayat Transfer Stok Antar-Cabang"
          subtitle="Pelacakan status pengiriman dan penerimaan inventori"
        />
        <div className="divide-y divide-warm-100">
          {transfersQ.isLoading ? <Spinner /> :
           !transfersQ.data?.length ? (
            <EmptyState icon={<ArrowRightLeft size={28} />} title="Belum ada transfer stok" description="Klik 'Transfer Stok Baru' untuk memindahkan barang antar-cabang." />
          ) : (
            (transfersQ.data as TransferItem[]).map((t: TransferItem) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-xs">
                <div className="min-w-[200px] flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-gray-900">{t.transferNo}</p>
                    <Badge tone={
                      t.status === "completed" ? "green" :
                      t.status === "in_transit" ? "blue" :
                      t.status === "cancelled" ? "red" : "amber"
                    }>
                      {t.status === "pending" ? "Menunggu Kirim" :
                       t.status === "in_transit" ? "Sedang Dikirim" :
                       t.status === "completed" ? "Diterima / Selesai" : "Dibatalkan"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-gray-600">
                    <span className="font-semibold">{t.fromOutletName}</span> ➔ <span className="font-semibold">{t.toOutletName}</span>
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Dibuat: {formatDateTime(t.createdAt)} {t.notes ? `· Catatan: ${t.notes}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {t.status === "pending" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateTransferStatusMut.mutate({ transferId: t.id, status: "in_transit" })}
                    >
                      <Truck size={14} /> Kirim Barang
                    </Button>
                  )}
                  {t.status === "in_transit" && (
                    <Button
                      size="sm"
                      onClick={() => updateTransferStatusMut.mutate({ transferId: t.id, status: "completed" })}
                    >
                      <CheckCircle size={14} /> Konfirmasi Diterima
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Create Outlet Modal */}
      <Modal open={createOutletModal} onClose={() => setCreateOutletModal(false)} title="Tambah Cabang / Outlet Baru">
        <div className="space-y-3">
          <div>
            <Label>Nama Cabang *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Cabang Pasar Minggu" />
          </div>
          <div>
            <Label>Kode Singkat Cabang *</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Contoh: CB2" />
          </div>
          <div>
            <Label>Alamat (Opsional)</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Alamat lengkap lokasi" />
          </div>
          <div>
            <Label>Nomor Telepon (Opsional)</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxx" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCreateOutletModal(false)}>Batal</Button>
            <Button
              disabled={createOutletMut.isPending || !name.trim() || !code.trim()}
              onClick={() => createOutletMut.mutate({ name, code, address, phone })}
            >
              Simpan Cabang
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Stock Transfer Modal */}
      {createTransferModal && (
        <CreateTransferModal
          outlets={outletsQ.data ?? []}
          onClose={(refetch) => {
            setCreateTransferModal(false);
            if (refetch) void transfersQ.refetch();
          }}
        />
      )}
    </div>
  );
}

function CreateTransferModal({
  outlets,
  onClose,
}: {
  outlets: Array<{ id: number; name: string }>;
  onClose: (refetch: boolean) => void;
}) {
  const [fromOutletId, setFromOutletId] = useState(outlets[0]?.id ?? 0);
  const [toOutletId, setToOutletId] = useState(outlets[1]?.id ?? 0);
  const [notes, setNotes] = useState("");
  const [pickQ, setPickQ] = useState("");
  const [items, setItems] = useState<Array<{ variantId: number; nameText: string; qty: number; stock: number }>>([]);

  const pickQ2 = trpc.inventory.variantsForPick.useQuery(
    { q: pickQ.length >= 2 ? pickQ : undefined, limit: 8 },
    { enabled: true }
  );

  const createMut = trpc.outlets.createTransfer.useMutation({
    onSuccess: () => {
      toast("Transfer stok berhasil dibuat");
      onClose(true);
    },
    onError: (e: { message: string }) => toast(e.message, "err"),
  });

  function submit() {
    if (!fromOutletId || !toOutletId) return toast("Pilih cabang asal dan tujuan", "err");
    if (fromOutletId === toOutletId) return toast("Cabang asal dan tujuan tidak boleh sama", "err");
    if (!items.length) return toast("Tambahkan minimal 1 item untuk ditransfer", "err");

    createMut.mutate({
      fromOutletId,
      toOutletId,
      notes: notes || null,
      items: items.map(i => ({ variantId: i.variantId, qty: i.qty })),
    });
  }

  return (
    <Modal open onClose={() => onClose(false)} title="Buat Transfer Stok Baru" wide>
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <Label>Dari Cabang (Asal) *</Label>
            <NativeSelect value={fromOutletId} onChange={(e) => setFromOutletId(Number(e.target.value))}>
              {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </NativeSelect>
          </div>
          <div>
            <Label>Ke Cabang (Tujuan) *</Label>
            <NativeSelect value={toOutletId} onChange={(e) => setToOutletId(Number(e.target.value))}>
              <option value={0}>— Pilih Cabang Tujuan —</option>
              {outlets.filter(o => o.id !== fromOutletId).map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </NativeSelect>
          </div>
        </div>

        <div>
          <Label>Tambah Item Produk</Label>
          <Input
            placeholder="Cari produk / barcode yang akan ditransfer…"
            value={pickQ}
            onChange={(e) => setPickQ(e.target.value)}
          />
          {pickQ.length >= 2 && pickQ2.data && (
            <ul className="mt-1 max-h-36 divide-y divide-warm-100 overflow-y-auto rounded-lg border border-warm-200 bg-white">
              {pickQ2.data.map(v => (
                <li key={v.variantId}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-xs hover:bg-warm-100"
                    onClick={() => {
                      if (items.some(i => i.variantId === v.variantId)) {
                        toast("Item sudah ada di daftar", "err");
                        return;
                      }
                      setItems(prev => [...prev, {
                        variantId: v.variantId,
                        nameText: `${v.name} — ${v.label}`,
                        qty: 1,
                        stock: v.stock,
                      }]);
                      setPickQ("");
                    }}
                  >
                    <span className="font-semibold">{v.name}</span> <span className="text-gray-500">({v.label})</span>
                    <span className="float-right text-brand-700">stok {v.stock}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
            {items.map((it, idx) => (
              <div key={it.variantId} className="flex items-center justify-between rounded-lg border border-warm-200 bg-warm-50 p-2.5">
                <div className="min-w-0 flex-1 pr-2">
                  <p className="truncate text-xs font-semibold">{it.nameText}</p>
                  <p className="text-[10px] text-gray-500">Stok tersedia: {it.stock}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    inputMode="numeric"
                    className="h-8 w-20 text-center text-xs"
                    value={it.qty || ""}
                    onChange={(e) => {
                      const val = Number(e.target.value.replace(/\D/g, "")) || 1;
                      setItems(prev => prev.map((x, xi) => xi === idx ? { ...x, qty: val } : x));
                    }}
                  />
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => setItems(prev => prev.filter((_, xi) => xi !== idx))}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div>
          <Label>Catatan Pengiriman (Opsional)</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contoh: Titip kurir ekspedisi / armada toko" />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onClose(false)}>Batal</Button>
          <Button disabled={createMut.isPending || !items.length} onClick={submit}>
            Simpan Transfer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
