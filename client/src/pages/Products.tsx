import { useState } from "react";
import { trpc } from "../lib/trpc.js";
import { formatRupiah } from "@shared/money.js";
import {
  Button, Card, Input, Label, NativeSelect, Badge, Spinner, Modal,
  EmptyState, toast, cn
} from "../components/ui.js";
import { BarcodeScanner } from "../components/BarcodeScanner.js";
import { lookupBarcode } from "../lib/barcode-lookup.js";
import { Plus, Pencil, Archive, PackageSearch, ScanLine, Trash2 } from "lucide-react";

type VariantForm = { id?: number; label: string; barcode: string; sellingPrice: number; costPrice: number; stock: number };

export default function Products({ role }: { role?: string }) {
  const isAdmin = role === "owner" || role === "admin";
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [editing, setEditing] = useState<number | null>(null); // null=closed, 0=create, >0=edit id
  const [adjusting, setAdjusting] = useState<number | null>(null); // productId sesi stok ±
  const [scanOpen, setScanOpen] = useState(false);
  const utils = trpc.useUtils();

  const list = trpc.products.list.useQuery({ q: debounced || undefined, lowStock: lowOnly || undefined, limit: 100 });

  function search(v: string) {
    setQ(v);
    setTimeout(() => setDebounced(v), 250);
  }

  // Scan di halaman Produk = cari produk by barcode lalu buka form editnya.
  async function handleScan(code: string) {
    const hit = await lookupBarcode(code);
    if (!hit) { toast(`Barcode ${code} tidak ditemukan`, "err"); return; }
    toast(`${hit.name} ditemukan`);
    setEditing(hit.productId);
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input className="max-w-xs" placeholder="Cari nama/kategori/barcode…" value={q} onChange={(e) => search(e.target.value)} />
        <Button variant="outline" aria-label="Scan barcode untuk mencari produk" onClick={() => setScanOpen(true)}><ScanLine size={16} /> Scan</Button>
        <Button variant={lowOnly ? "default" : "outline"} onClick={() => setLowOnly(l => !l)}>Stok menipis</Button>
        <div className="ml-auto">
          <Button onClick={() => setEditing(0)}><Plus size={16} /> Produk baru</Button>
        </div>
      </div>

      {list.isLoading ? <Spinner /> : !list.data?.items.length ? (
        <Card><EmptyState icon={<PackageSearch size={28} />} title="Belum ada produk" description="Tambahkan produk pertama Anda." /></Card>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {list.data.items.map(p => (
            <ProductRow key={p.id} product={p} isAdmin={isAdmin}
              onEdit={() => setEditing(p.id)} onAdjust={() => setAdjusting(p.id)} />
          ))}
        </div>
      )}

      {editing !== null && (
        <ProductFormModal id={editing === 0 ? null : editing} onClose={(changed) => {
          setEditing(null);
          if (changed) void utils.products.list.invalidate();
        }} />
      )}

      {adjusting !== null && (
        <StockAdjustModal productId={adjusting} onClose={(changed) => {
          setAdjusting(null);
          if (changed) void utils.products.list.invalidate();
        }} />
      )}

      {scanOpen && (
        <BarcodeScanner
          onDetect={(code) => { setScanOpen(false); void handleScan(code); }}
          onClose={() => setScanOpen(false)}
        />
      )}
    </div>
  );
}

function ProductRow({ product, isAdmin, onEdit, onAdjust }: {
  product: { id: number; name: string; category: string; barcode: string | null; stock: number; minStock: number };
  isAdmin: boolean;
  onEdit: () => void;
  onAdjust: () => void;
}) {
  const archive = trpc.products.archive.useMutation({
    onSuccess: () => toast("Produk diarsipkan"),
    onError: (e) => toast(e.message, "err"),
  });
  const remove = trpc.products.delete.useMutation({
    onSuccess: () => toast("Produk dihapus permanen"),
    onError: (e) => toast(e.message, "err"),
  });
  const low = product.stock <= product.minStock;
  return (
    <Card className="p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-800">{product.name}</p>
          <p className="text-[11px] text-gray-500">{product.category}{product.barcode ? ` · ${product.barcode}` : ""}</p>
        </div>
        <Badge tone={low ? "amber" : "green"}>{low ? "Stok menipis" : "Aman"}</Badge>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-sm"><span className="font-bold">{product.stock}</span> <span className="text-xs text-gray-400">/ min {product.minStock}</span></p>
        <div className="flex flex-wrap justify-end gap-1.5">
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={onAdjust} title="Tambah/kurang stok (tercatat di mutasi)">
              ± Stok
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onEdit}><Pencil size={13} /> Edit</Button>
          {isAdmin && (
            <>
              <Button variant="ghost" size="icon" aria-label="Arsipkan" title="Arsipkan (sembunyikan, riwayat aman)"
                onClick={() => { if (confirm(`Arsipkan ${product.name}?`)) archive.mutate({ id: product.id }); }}>
                <Archive size={14} />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Hapus permanen" title="Hapus permanen (hanya jika tanpa riwayat)"
                className="text-red-600 hover:bg-red-50"
                onClick={() => { if (confirm(`Hapus PERMANEN ${product.name}? Jika produk sudah punya transaksi, server akan menolak — gunakan Arsipkan.`)) remove.mutate({ id: product.id }); }}>
                <Trash2 size={14} />
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function StockAdjustModal({ productId, onClose }: { productId: number; onClose: (changed: boolean) => void }) {
  const detail = trpc.products.get.useQuery({ id: productId });
  const adjust = trpc.inventory.adjustStock.useMutation({
    onSuccess: (_d, vars) => {
      const delta = vars.deltaQty;
      toast(`Stok ${delta > 0 ? "+" : ""}${delta} dicatat`);
      onClose(true);
    },
    onError: (e) => toast(e.message, "err"),
  });

  const activeVariants = (detail.data?.variants ?? []).filter(v => v.isActive);
  const [variantId, setVariantId] = useState<number | null>(null);
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");

  if (detail.isLoading) return <Modal open onClose={() => onClose(false)} title="Sesuaikan stok"><Spinner /></Modal>;

  return (
    <Modal open onClose={() => onClose(false)} title={`Sesuaikan stok — ${detail.data?.name ?? ""}`}>
      <div className="space-y-3">
        <div>
          <Label>Varian</Label>
          <NativeSelect value={variantId ?? ""} onChange={(e) => setVariantId(Number(e.target.value) || null)}>
            <option value="">Pilih varian…</option>
            {activeVariants.map(v => (
              <option key={v.id} value={v.id}>{v.label} — sisa {v.stock}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Arah</Label>
            <NativeSelect value={direction} onChange={(e) => setDirection(e.target.value as "in" | "out")}>
              <option value="in">Tambah (+)</option>
              <option value="out">Kurang (−)</option>
            </NativeSelect>
          </div>
          <div>
            <Label>Jumlah</Label>
            <Input inputMode="numeric" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, "")) || 0)} placeholder="0" />
          </div>
        </div>
        <div>
          <Label>Alasan</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="mis. barang rusak, hadiah, selisih hitung" />
        </div>
        <p className="text-[11px] text-gray-400">Setiap penyesuaian tercatat sebagai mutasi stok bertipe adjustment.</p>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => onClose(false)}>Batal</Button>
          <Button
            disabled={!variantId || amount < 1 || reason.trim().length < 3 || adjust.isPending}
            onClick={() => variantId && adjust.mutate({
              variantId,
              deltaQty: direction === "in" ? amount : -amount,
              reason: reason.trim(),
            })}>
            {adjust.isPending ? "Menyimpan…" : direction === "in" ? `+${amount || 0}` : `−${amount || 0}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ProductFormModal({ id, onClose }: { id: number | null; onClose: (changed: boolean) => void }) {
  const detail = trpc.products.get.useQuery({ id: id! }, { enabled: id !== null });
  const categories = trpc.products.categories.useQuery();
  const create = trpc.products.create.useMutation({
    onSuccess: () => { toast("Produk dibuat"); onClose(true); },
    onError: (e) => toast(e.message, "err"),
  });
  const update = trpc.products.update.useMutation({
    onSuccess: () => { toast("Produk diperbarui"); onClose(true); },
    onError: (e) => toast(e.message, "err"),
  });

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [barcode, setBarcode] = useState("");
  const [minStock, setMinStock] = useState(0);
  const [variants, setVariants] = useState<VariantForm[]>([{ label: "", barcode: "", sellingPrice: 0, costPrice: 0, stock: 0 }]);
  const [loaded, setLoaded] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  if (id !== null && detail.data && !loaded) {
    setName(detail.data.name);
    setCategory(detail.data.category);
    setBarcode(detail.data.barcode ?? "");
    setMinStock(detail.data.minStock);
    setVariants(detail.data.variants.map(v => ({ id: v.id, label: v.label, barcode: v.barcode ?? "", sellingPrice: v.sellingPrice, costPrice: v.costPrice, stock: v.stock })));
    setLoaded(true);
  }

  function submit() {
    setFormErr(null);
    if (!name.trim()) return setFormErr("Nama produk wajib");
    if (!category.trim()) return setFormErr("Kategori wajib");
    if (variants.some(v => !v.label.trim())) return setFormErr("Label varian wajib");
    const payload = {
      name: name.trim(),
      category: category.trim(),
      barcode: barcode.trim() || undefined,
      minStock,
      variants: variants.map((v) => ({
        ...(id !== null && v.id ? { id: v.id } : {}),
        label: v.label.trim(),
        barcode: v.barcode.trim() || null,
        sellingPrice: v.sellingPrice,
        costPrice: v.costPrice,
        stock: v.stock,
        isActive: true,
      })),
    };
    if (id === null) create.mutate(payload as never);
    else update.mutate({ id, ...payload } as never);
  }

  return (
    <Modal open onClose={() => onClose(false)} title={id === null ? "Produk baru" : "Edit produk"} wide>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Nama produk *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div>
            <Label>Kategori *</Label>
            <Input list="cats" value={category} onChange={(e) => setCategory(e.target.value)} />
            <datalist id="cats">{categories.data?.map(c => <option key={c} value={c} />)}</datalist>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Barcode utama</Label><Input value={barcode} onChange={(e) => setBarcode(e.target.value)} inputMode="numeric" /></div>
          <div><Label>Stok minimum</Label><Input inputMode="numeric" value={minStock || ""} onChange={(e) => setMinStock(Number(e.target.value.replace(/\D/g, "")) || 0)} /></div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label className="mb-0">Varian satuan/ukuran *</Label>
            <Button size="sm" variant="outline" onClick={() => setVariants(v => [...v, { label: "", barcode: "", sellingPrice: 0, costPrice: 0, stock: 0 }])}>+ Varian</Button>
          </div>
          <div className="space-y-2">
            {variants.map((v, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-warm-200 p-2 sm:grid-cols-6">
                <div className="col-span-2 sm:col-span-2"><Label>Label</Label><Input placeholder="Pack 200 g" value={v.label} onChange={(e) => setVariants(arr => arr.map((x, xi) => xi === i ? { ...x, label: e.target.value } : x))} /></div>
                <div className="col-span-2 sm:col-span-2"><Label>Barcode</Label><Input inputMode="numeric" value={v.barcode} onChange={(e) => setVariants(arr => arr.map((x, xi) => xi === i ? { ...x, barcode: e.target.value } : x))} /></div>
                <div><Label>Harga jual</Label><Input inputMode="numeric" value={v.sellingPrice || ""} onChange={(e) => setVariants(arr => arr.map((x, xi) => xi === i ? { ...x, sellingPrice: Number(e.target.value.replace(/\D/g, "")) || 0 } : x))} /></div>
                <div><Label>Modal</Label><Input inputMode="numeric" value={v.costPrice || ""} onChange={(e) => setVariants(arr => arr.map((x, xi) => xi === i ? { ...x, costPrice: Number(e.target.value.replace(/\D/g, "")) || 0 } : x))} /></div>
                <div className="col-span-2 flex items-end gap-2 sm:col-span-6">
                  <div className="w-28"><Label>Stok awal</Label>
                    <Input inputMode="numeric" value={v.stock || ""} disabled={id !== null}
                      onChange={(e) => setVariants(arr => arr.map((x, xi) => xi === i ? { ...x, stock: Number(e.target.value.replace(/\D/g, "")) || 0 } : x))} />
                  </div>
                  {id !== null && <p className="pb-2 text-[10px] text-gray-400">Stok edit lewat penyesuaian/opname</p>}
                  {variants.length > 1 && (
                    <Button variant="ghost" size="sm" className="ml-auto mb-1 text-red-600"
                      onClick={() => setVariants(arr => arr.filter((_, xi) => xi !== i))}>Hapus</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {formErr && <p className="text-xs text-red-600">{formErr}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => onClose(false)}>Batal</Button>
          <Button onClick={submit} disabled={create.isPending || update.isPending}>
            {(create.isPending || update.isPending) ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
