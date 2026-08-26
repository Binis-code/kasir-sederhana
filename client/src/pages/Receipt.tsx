import { useEffect } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "../lib/trpc.js";
import { Button, Spinner, formatDateTime } from "../components/ui.js";
import { formatRupiah } from "@shared/money.js";

type StoreInfo = { name: string; address: string; phone: string };

export default function Receipt() {
  const [, params] = useRoute("/receipt/:id");
  const id = Number(params?.id ?? 0);
  const sale = trpc.pos.getSale.useQuery({ id }, { enabled: id > 0 });

  useEffect(() => {
    fetch("/api/store-info").then(r => r.json()).then((s: StoreInfo) => {
      (window as unknown as { __storeInfo?: StoreInfo }).__storeInfo = s;
    }).catch(() => undefined);
  }, []);

  if (!id || sale.isLoading) return <Spinner className="min-h-screen" />;
  if (sale.isError) return <p className="p-6 text-sm text-red-600">{sale.error.message}</p>;
  const s = sale.data!;
  const store = (window as unknown as { __storeInfo?: StoreInfo }).__storeInfo;

  return (
    <div className="min-h-screen bg-warm-100 py-6">
      <div className="mx-auto w-[80mm] max-w-full">
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
                      <span>{formatRupiah(it.qty * it.unitPrice - it.discount)}</span>
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

        <div className="no-print mt-4 flex gap-2">
          <Button size="lg" className="flex-1" onClick={() => window.print()}>Cetak struk</Button>
          <Link href="/pos">
            <Button variant="outline" size="lg">Transaksi baru</Button>
          </Link>
        </div>
        <p className="no-print mt-2 text-center text-[11px] text-gray-500">
          Jika printer thermal tidak terdeteksi, pastikan printer 80 mm sudah terinstal di sistem lalu pilih pada dialog cetak browser.
        </p>
      </div>
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

