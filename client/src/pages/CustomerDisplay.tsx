import { useEffect, useState } from "react";
import { formatRupiah } from "@shared/money.js";
import { getDisplayChannel, type CustomerDisplayPayload } from "../lib/escpos.js";
import { ShoppingCart, CheckCircle2, Store, QrCode, Maximize2, Minimize2, Sparkles } from "lucide-react";

export default function CustomerDisplay() {
  const [data, setData] = useState<CustomerDisplayPayload>({
    storeName: "Kios Nusa",
    items: [],
    subtotal: 0,
    discountTotal: 0,
    total: 0,
  });
  const [timeStr, setTimeStr] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => undefined);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => undefined);
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-warm-950 font-sans text-white select-none">
      {/* Top Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-warm-800 bg-warm-900 px-6 shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 font-bold text-white shadow-lg">
            <Store size={22} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wide text-white">{data.storeName || "Kios Nusa"}</h1>
            <p className="text-[11px] text-warm-400">Layar Tampilan Pelanggan (Customer Display)</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <p className="font-mono text-xl font-bold text-brand-400">{timeStr}</p>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-warm-700 bg-warm-800 text-warm-300 transition-colors hover:bg-warm-700 hover:text-white"
            title="Layar Penuh (Fullscreen)"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </header>

      {/* Main Body */}
      {data.isSuccess ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-warm-950 p-8 text-center animate-fade-in">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-green-500/20 text-green-400 animate-bounce shadow-xl shadow-green-900/30">
            <CheckCircle2 size={72} />
          </div>
          <h2 className="text-4xl font-black text-white">Transaksi Berhasil!</h2>
          <p className="text-lg text-warm-300">
            No. Nota: <span className="font-mono font-bold text-brand-300">{data.invoiceNo}</span>
          </p>

          <div className="mt-2 min-w-[320px] rounded-3xl border border-warm-800 bg-warm-900/80 p-6 shadow-2xl backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-wider text-warm-400">Total Pembayaran</p>
            <p className="mt-1 text-5xl font-black text-brand-400">{formatRupiah(data.total)}</p>
            {(data.changeAmount ?? 0) > 0 && (
              <div className="mt-3 rounded-xl bg-green-950/60 p-2.5 border border-green-700/40">
                <p className="text-xs text-green-300">Kembalian Uang Tunai</p>
                <p className="text-2xl font-black text-green-400">{formatRupiah(data.changeAmount!)}</p>
              </div>
            )}
          </div>
          <p className="text-sm text-warm-400">Terima kasih atas kunjungan Anda. Silakan ambil struk belanja.</p>
        </div>
      ) : !data.items.length ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-warm-900 text-warm-400 shadow-xl">
            <ShoppingCart size={48} className="text-brand-400" />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-warm-100">Selamat Datang di {data.storeName || "Kios Nusa"}</h2>
            <p className="mt-2 max-w-md text-base text-warm-400">
              Kasir siap melayani pesanan Anda. Produk yang dipindai akan langsung tampil di monitor ini.
            </p>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-950/40 px-5 py-2 text-xs font-semibold text-brand-300">
            <Sparkles size={16} /> Belanja hemat & praktis bersama Kios Nusa
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Itemized list */}
          <div className="flex flex-1 flex-col border-r border-warm-800 p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400">
                Rincian Belanja ({data.items.length} item)
              </h2>
              <span className="text-xs font-semibold text-brand-400">Pembaruan Real-Time</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-2">
              {data.items.map((it, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-2xl border border-warm-800/80 bg-warm-900/60 p-4 shadow-sm transition-all hover:bg-warm-900"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="truncate text-lg font-bold text-white">{it.name}</p>
                    <p className="text-sm text-warm-400">
                      {it.qty} × {formatRupiah(it.price)}
                    </p>
                  </div>
                  <span className="text-xl font-extrabold text-brand-300">{formatRupiah(it.lineTotal)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Payment summary & QRIS banner */}
          <div className="flex w-[420px] flex-col justify-between bg-warm-900 p-6 shadow-xl">
            <div className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400">Ringkasan Tagihan</h2>
              <div className="space-y-2.5 rounded-2xl border border-warm-800 bg-warm-950 p-4 text-sm text-warm-300">
                <div className="flex justify-between">
                  <span>Subtotal Belanja</span>
                  <span className="font-semibold text-white">{formatRupiah(data.subtotal)}</span>
                </div>
                {data.discountTotal > 0 && (
                  <div className="flex justify-between text-red-400 font-semibold">
                    <span>Total Diskon</span>
                    <span>-{formatRupiah(data.discountTotal)}</span>
                  </div>
                )}
              </div>

              {data.paymentMethod === "qris" && (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-brand-500/40 bg-brand-950/60 p-5 text-center shadow-lg">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-900 text-brand-300">
                    <QrCode size={40} />
                  </div>
                  <p className="mt-2 text-sm font-bold text-white">Pembayaran QRIS Nasional</p>
                  <p className="text-xs text-warm-400">Scan QRIS dari aplikasi GoPay, OVO, Dana, BCA, Livin, dll.</p>
                </div>
              )}
            </div>

            <div className="rounded-3xl border-2 border-brand-500/60 bg-brand-950/80 p-6 text-center shadow-2xl">
              <p className="text-xs font-extrabold uppercase tracking-widest text-brand-300">TOTAL YANG HARUS DIBAYAR</p>
              <p className="mt-1 text-4xl font-black text-white">{formatRupiah(data.total)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Running Promo Ticker Footer */}
      <footer className="flex h-10 shrink-0 items-center overflow-hidden border-t border-warm-800 bg-warm-950 px-6 text-xs text-warm-400">
        <div className="flex items-center gap-2 whitespace-nowrap font-medium text-brand-300">
          <Sparkles size={14} />
          <span>Kios Nusa POS · Belanja Hemat, Proses Cepat, Struk Tersedia Langsung via WhatsApp & Cetak Thermal.</span>
        </div>
      </footer>
    </div>
  );
}
