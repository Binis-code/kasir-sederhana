import { useEffect, useState } from "react";
import { formatRupiah } from "@shared/money.js";
import { getDisplayChannel, type CustomerDisplayPayload } from "../lib/escpos.js";
import { ShoppingCart, CheckCircle2, Store, QrCode } from "lucide-react";

export default function CustomerDisplay() {
  const [data, setData] = useState<CustomerDisplayPayload>({
    storeName: "Kios Nusa",
    items: [],
    subtotal: 0,
    discountTotal: 0,
    total: 0,
  });
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const ch = getDisplayChannel();
    if (!ch) return;

    const handler = (ev: MessageEvent<CustomerDisplayPayload>) => {
      if (ev.data) setData(ev.data);
    };

    ch.addEventListener("message", handler);
    return () => ch.removeEventListener("message", handler);
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col bg-warm-900 font-sans text-white">
      {/* Top Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-warm-800 bg-warm-950 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 font-bold text-white shadow-lg">
            <Store size={22} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wide text-white">{data.storeName || "Kios Nusa"}</h1>
            <p className="text-[11px] text-warm-400">Layar Tampilan Pelanggan (Customer Display)</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-xl font-bold text-brand-400">{timeStr}</p>
        </div>
      </header>

      {/* Main Body */}
      {data.isSuccess ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-warm-900 p-8 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-500/20 text-green-400 animate-bounce">
            <CheckCircle2 size={64} />
          </div>
          <h2 className="text-3xl font-black text-white">Terima Kasih Telah Berbelanja!</h2>
          <p className="text-lg text-warm-300">
            Invoice: <span className="font-mono font-bold text-white">{data.invoiceNo}</span>
          </p>
          <div className="rounded-2xl border border-warm-700 bg-warm-800/60 p-6 shadow-xl">
            <p className="text-sm text-warm-400">Total Pembayaran</p>
            <p className="text-4xl font-extrabold text-brand-400">{formatRupiah(data.total)}</p>
            {(data.changeAmount ?? 0) > 0 && (
              <p className="mt-2 text-lg font-bold text-green-400">
                Kembalian: {formatRupiah(data.changeAmount!)}
              </p>
            )}
          </div>
          <p className="text-xs text-warm-500">Silakan ambil struk dan barang belanjaan Anda.</p>
        </div>
      ) : !data.items.length ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-warm-800 text-warm-400">
            <ShoppingCart size={40} />
          </div>
          <h2 className="text-2xl font-bold text-warm-100">Selamat Datang di {data.storeName || "Kios Nusa"}</h2>
          <p className="max-w-md text-sm text-warm-400">
            Kasir siap melayani belanjaan Anda. Item yang discan akan otomatis tampil di layar ini.
          </p>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Itemized list */}
          <div className="flex flex-1 flex-col border-r border-warm-800 p-6">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-warm-400">
              Daftar Belanjaan ({data.items.length} item)
            </h2>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {data.items.map((it, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-xl border border-warm-800 bg-warm-800/40 p-4 shadow-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-white">{it.name}</p>
                    <p className="text-xs text-warm-400">
                      {it.qty} × {formatRupiah(it.price)}
                    </p>
                  </div>
                  <span className="text-base font-bold text-brand-300">{formatRupiah(it.lineTotal)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Payment summary & QRIS banner */}
          <div className="flex w-96 flex-col justify-between bg-warm-950 p-6">
            <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-warm-400">Ringkasan Tagihan</h2>
              <div className="space-y-2 text-sm text-warm-300">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatRupiah(data.subtotal)}</span>
                </div>
                {data.discountTotal > 0 && (
                  <div className="flex justify-between text-red-400">
                    <span>Total Diskon</span>
                    <span>-{formatRupiah(data.discountTotal)}</span>
                  </div>
                )}
              </div>

              {data.paymentMethod === "qris" && (
                <div className="flex flex-col items-center justify-center rounded-xl border border-brand-500/40 bg-brand-950/40 p-4 text-center">
                  <QrCode size={36} className="text-brand-400" />
                  <p className="mt-1 text-xs font-bold text-white">Pembayaran via QRIS</p>
                  <p className="text-[10px] text-warm-400">Scan QRIS dari aplikasi m-Banking / E-Wallet</p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-brand-500/40 bg-brand-900/30 p-5 text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-brand-300">TOTAL BAYAR</p>
              <p className="mt-1 text-3xl font-black text-white">{formatRupiah(data.total)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
