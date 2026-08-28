import { useState } from "react";
import { trpc } from "../lib/trpc.js";
import { formatRupiah } from "@shared/money.js";
import { Button, Card, CardHeader, Input, Label, NativeSelect, Badge, Spinner, cn } from "../components/ui.js";
import { Printer, Barcode, CheckSquare, Square, Tags } from "lucide-react";

type BarcodeItem = {
  variantId: number;
  productName: string;
  category: string;
  variantLabel: string;
  barcode: string | null;
  sellingPrice: number;
  displayBarcode: string;
};

export default function BarcodeGenerator() {
  const catalogQ = trpc.tools.barcodeCatalog.useQuery();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [format, setFormat] = useState<"shelf" | "sticker">("shelf");
  const [search, setSearch] = useState("");

  const items: BarcodeItem[] = ((catalogQ.data ?? []) as BarcodeItem[]).filter((it: BarcodeItem) =>
    !search || it.productName.toLowerCase().includes(search.toLowerCase()) || it.category.toLowerCase().includes(search.toLowerCase())
  );

  function toggleSelect(id: number) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function selectAll() {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((i: BarcodeItem) => i.variantId));
    }
  }

  const printItems: BarcodeItem[] = ((catalogQ.data ?? []) as BarcodeItem[]).filter((it: BarcodeItem) => selectedIds.includes(it.variantId));

  return (
    <div className="space-y-6 p-4">
      {/* Top Header */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900">Cetak Barcode & Label Harga Rak</h2>
          <p className="text-xs text-gray-500">Generator stiker barcode produk dan label harga rak toko siap print</p>
        </div>
        <div className="flex gap-2">
          <Button
            disabled={!printItems.length}
            onClick={() => window.print()}
          >
            <Printer size={16} /> Cetak {printItems.length} Label
          </Button>
        </div>
      </div>

      {/* Control Panel (Hidden on Print) */}
      <div className="no-print grid gap-4 lg:grid-cols-3">
        {/* Left: Product Selector */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-warm-100 p-3">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={selectAll}>
                {selectedIds.length === items.length && items.length > 0 ? <CheckSquare size={14} /> : <Square size={14} />}
                {selectedIds.length === items.length && items.length > 0 ? "Batal Semua" : "Pilih Semua"}
              </Button>
              <span className="text-xs text-gray-500">{selectedIds.length} dipilih</span>
            </div>
            <Input
              placeholder="Cari produk…"
              className="h-8 w-48 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-warm-100 p-2">
            {catalogQ.isLoading ? <Spinner /> :
             !items.length ? <p className="p-4 text-center text-xs text-gray-400">Tidak ada produk ditemukan</p> :
             items.map((it: BarcodeItem) => {
              const selected = selectedIds.includes(it.variantId);
              return (
                <div
                  key={it.variantId}
                  onClick={() => toggleSelect(it.variantId)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-lg p-2.5 text-xs transition-colors",
                    selected ? "bg-brand-50" : "hover:bg-warm-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => undefined}
                      className="rounded text-brand-600 focus:ring-brand-500"
                    />
                    <div>
                      <p className="font-semibold text-gray-900">{it.productName} ({it.variantLabel})</p>
                      <p className="text-[11px] font-mono text-gray-500">{it.displayBarcode}</p>
                    </div>
                  </div>
                  <span className="font-bold text-brand-700">{formatRupiah(it.sellingPrice)}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Right: Layout Options */}
        <Card className="p-4 space-y-4">
          <CardHeader title="Pengaturan Format Label" />
          <div>
            <Label>Tipe Label</Label>
            <NativeSelect value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
              <option value="shelf">Label Harga Rak Toko (Besar & Jelas)</option>
              <option value="sticker">Stiker Barcode Produk (Kecil / Tempel Kemasan)</option>
            </NativeSelect>
          </div>
          <div className="rounded-lg bg-warm-50 p-3 text-xs text-gray-600">
            <p className="font-semibold text-gray-800">Petunjuk Cetak:</p>
            <ul className="mt-1 list-disc list-inside space-y-1">
              <li>Pilih produk yang ingin dicetak labelnya dari daftar kiri.</li>
              <li>Klik tombol <b>Cetak Label</b>.</li>
              <li>Pada dialog cetak browser, gunakan kertas A4 atau kertas stiker.</li>
            </ul>
          </div>
        </Card>
      </div>

      {/* Printable Sheet View */}
      <div>
        <div className="no-print mb-2 flex items-center gap-2">
          <Tags size={16} className="text-gray-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Pratinjau Lembar Cetak</h3>
        </div>

        {!printItems.length ? (
          <div className="no-print rounded-xl border border-dashed border-warm-300 p-8 text-center text-xs text-gray-400">
            Pilih minimal 1 produk di atas untuk melihat pratinjau lembar barcode.
          </div>
        ) : (
          <div className={cn(
            "grid gap-3 bg-white p-4 print:p-0",
            format === "shelf" ? "grid-cols-2 sm:grid-cols-3 print:grid-cols-3" : "grid-cols-3 sm:grid-cols-4 print:grid-cols-4"
          )}>
            {printItems.map((it: BarcodeItem) => (
              <div
                key={it.variantId}
                className={cn(
                  "flex flex-col justify-between rounded border border-gray-400 bg-white p-2.5 text-black print:border-black",
                  format === "shelf" ? "min-h-[110px]" : "min-h-[80px]"
                )}
              >
                <div>
                  <p className="truncate text-xs font-bold uppercase text-gray-900">{it.productName}</p>
                  <p className="text-[10px] text-gray-600">{it.variantLabel} · {it.category}</p>
                </div>

                <div className="my-1.5 flex flex-col items-center">
                  <FakeBarcode code={it.displayBarcode} />
                  <span className="font-mono text-[9px] tracking-widest text-gray-700">{it.displayBarcode}</span>
                </div>

                <div className="flex items-center justify-between border-t border-dashed border-gray-300 pt-1">
                  <span className="text-[9px] font-semibold text-gray-500">HARGA</span>
                  <span className="text-sm font-extrabold text-black">{formatRupiah(it.sellingPrice)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FakeBarcode({ code }: { code: string }) {
  // Generate consistent bar widths from string hash
  const bars = Array.from(code).map((char, i) => {
    const num = char.charCodeAt(0);
    return (num + i) % 2 === 0 ? "w-1" : "w-0.5";
  });

  return (
    <div className="flex h-6 items-center gap-0.5">
      {bars.map((w, idx) => (
        <div key={idx} className={cn("h-full bg-black", w)} />
      ))}
    </div>
  );
}
