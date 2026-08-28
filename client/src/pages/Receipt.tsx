import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "../lib/trpc.js";
import { Button, Spinner, formatDateTime, Input, Label, Modal, toast, cn } from "../components/ui.js";
import { formatRupiah, generateWhatsAppReceiptText } from "@shared/money.js";
import { Share2, Printer, ArrowLeft } from "lucide-react";

type StoreInfo = { name: string; address: string; phone: string };

export default function Receipt() {
  const [, params] = useRoute("/receipt/:id");
  const id = Number(params?.id ?? 0);
  const sale = trpc.pos.getSale.useQuery({ id }, { enabled: id > 0 });
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [paperSize, setPaperSize] = useState<"58mm" | "80mm">("80mm");
  const [waModal, setWaModal] = useState(false);
  const [waPhone, setWaPhone] = useState("");

  useEffect(() => {
    fetch("/api/store-info")
      .then(r => r.json())
      .then((s: StoreInfo) => setStore(s))
      .catch(() => undefined);
  }, []);

  if (!id || sale.isLoading) return <Spinner className="min-h-screen" />;
  if (sale.isError) return <p className="p-6 text-sm text-red-600">{sale.error.message}</p>;
  const s = sale.data!;

  function shareWA() {
    const cleanPhone = waPhone.replace(/\D/g, "").replace(/^0/, "62");
    if (!cleanPhone) {
      toast("Masukkan nomor WhatsApp pelanggan (misal: 0812xxxx)", "err");
      return;
    }
    const receiptText = generateWhatsAppReceiptText({
      storeName: store?.name ?? "Kios Nusa",
      storeAddress: store?.address,
      storePhone: store?.phone,
      invoiceNo: s.invoiceNo,
      dateStr: formatDateTime(s.createdAt),
      cashierName: s.cashierName,
      items: s.items.map(it => ({
        name: it.name,
        qty: it.qty,
        unitPrice: it.unitPrice,
        lineTotal: it.lineTotal,
      })),
      subtotal: s.subtotal,
      discountTotal: s.discountTotal + s.voucherDiscount,
      total: s.total,
      paymentMethod: s.paymentMethod,
      paidAmount: s.paidAmount,
      changeAmount: s.changeAmount,
    });

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(receiptText)}`;
    window.open(url, "_blank");
    setWaModal(false);
  }

  return (
    <div className="min-h-screen bg-warm-100 py-6">
      {/* Paper size switch bar */}
      <div className="no-print mx-auto mb-4 flex w-[80mm] max-w-full items-center justify-between px-2">
        <Link href="/pos">
          <Button variant="ghost" size="sm"><ArrowLeft size={14} /> Kasir</Button>
        </Link>
        <div className="flex gap-1 rounded-lg border border-warm-300 bg-white p-0.5">
          <button
            type="button"
            className={cn("rounded px-2 py-1 text-xs font-semibold", paperSize === "58mm" ? "bg-brand-700 text-white" : "text-gray-600")}
            onClick={() => setPaperSize("58mm")}
          >
            58 mm
          </button>
          <button
            type="button"
            className={cn("rounded px-2 py-1 text-xs font-semibold", paperSize === "80mm" ? "bg-brand-700 text-white" : "text-gray-600")}
            onClick={() => setPaperSize("80mm")}
          >
            80 mm
          </button>
        </div>
      </div>

      <div className={cn("mx-auto max-w-full shadow-md print:shadow-none", paperSize === "58mm" ? "w-[58mm]" : "w-[80mm]")}>
        <div className="receipt-area bg-white p-3 font-mono text-[11px] leading-tight text-black">
          <p className="text-center text-sm font-bold uppercase">{store?.name ?? "Kios Nusa"}</p>
          {store?.address ? <p className="text-center">{store.address}</p> : null}
          {store?.phone ? <p className="text-center">Telp: {store.phone}</p> : null}
          <Dashed />
          <Row k="No. Invoice" v={s.invoiceNo} />
          <Row k="Tanggal" v={formatDateTime(s.createdAt)} />
          <Row k="Kasir" v={s.cashierName} />
          {s.customerName ? <Row k="Pelanggan" v={s.customerName} /> : null}
          <Dashed />
          <table className="w-full">
            <tbody>
              {s.items.map(it => (
                <tr key={it.id} className="align-top">
                  <td colSpan={2} className="pt-1">
                    <p className="font-medium">{it.name}</p>
                    <div className="flex justify-between">
                      <span>{it.qty} × {formatRupiah(it.unitPrice)}</span>
                      <span>{formatRupiah(it.lineTotal)}</span>
                    </div>
                    {it.discount > 0 && (
                      <div className="flex justify-between text-[10px]">
                        <span>Diskon item</span>
                        <span>-{formatRupiah(it.discount)}</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Dashed />
          <Row k="Subtotal" v={formatRupiah(s.subtotal)} />
          {s.discountTotal > 0 && <Row k="Diskon" v={`-${formatRupiah(s.discountTotal)}`} />}
          {s.voucherCode ? <Row k={`Voucher ${s.voucherCode}`} v={`-${formatRupiah(s.voucherDiscount)}`} /> : null}
          <div className="flex justify-between border-t border-dashed border-black pt-1 text-sm font-bold">
            <span>TOTAL</span><span>{formatRupiah(s.total)}</span>
          </div>
          <Row k={`Bayar (${s.paymentMethod.toUpperCase()})`} v={formatRupiah(s.paidAmount)} />
          {s.changeAmount > 0 && <Row k="Kembalian" v={formatRupiah(s.changeAmount)} />}
          <Dashed />
          <p className="text-center">Terima kasih atas kunjungan Anda</p>
          <p className="text-center">Barang yang sudah dibeli tidak dapat dikembalikan</p>
        </div>

        <div className="no-print mt-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <Button size="lg" className="flex-1" onClick={() => window.print()}>
              <Printer size={16} /> Cetak struk
            </Button>
            <Button size="lg" className="bg-green-600 text-white hover:bg-green-700" onClick={() => setWaModal(true)}>
              <Share2 size={16} /> WA
            </Button>
          </div>
          <Link href="/pos">
            <Button variant="outline" size="lg" className="w-full">Transaksi baru</Button>
          </Link>
        </div>

        <p className="no-print mt-2 text-center text-[11px] text-gray-500">
          Untuk printer thermal mini, pilih format 58 mm atau 80 mm lalu cetak.
        </p>
      </div>

      {/* WhatsApp Modal */}
      <Modal open={waModal} onClose={() => setWaModal(false)} title="Kirim Nota via WhatsApp">
        <div className="space-y-3">
          <div>
            <Label>Nomor WhatsApp Pelanggan</Label>
            <Input
              placeholder="08123456789"
              value={waPhone}
              onChange={(e) => setWaPhone(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setWaModal(false)}>Batal</Button>
            <Button className="bg-green-600 text-white hover:bg-green-700" onClick={shareWA}>
              <Share2 size={14} /> Buka WhatsApp
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span>{k}</span><span>{v}</span>
    </div>
  );
}

function Dashed() {
  return <div className="my-1.5 border-t border-dashed border-black" />;
}
