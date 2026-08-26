import { useEffect, useRef, useState } from "react";
import { Button, Input } from "./ui.js";

type DetectorCtor = new (opts?: { formats?: string[] }) => {
  detect(src: HTMLVideoElement | ImageBitmap | Blob): Promise<{ rawValue: string }[]>;
};

const FORMATS = ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "qr_code"];

export function BarcodeScanner({ onDetect, onClose }: { onDetect: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const BD = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let detector: InstanceType<DetectorCtor> | null = null;

    async function start() {
      if (!BD) {
        setSupported(false);
        setError("Pemindai barcode tidak didukung browser ini. Masukkan barcode secara manual.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        detector = new BD({ formats: FORMATS });
        timer = setInterval(async () => {
          if (!detector || !videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0 && codes[0].rawValue) {
              stop();
              onDetect(codes[0].rawValue);
            }
          } catch { /* frame skip */ }
        }, 350);
      } catch (e) {
        setError("Kamera tidak dapat diakses. Izinkan akses kamera atau masukkan barcode manual.");
      }
    }

    start();
    return () => {
      cancelled = true;
      stop();
    };

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, [onDetect]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label="Pindai barcode">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <p className="text-sm font-medium">Arahkan barcode ke kamera</p>
        <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={() => { onClose(); }}>Tutup</Button>
      </div>
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {!supported || error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4">
            <p className="text-center text-xs text-white">{error}</p>
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-40 -translate-y-1/2 rounded-lg border-2 border-brand-300/80" />
        )}
      </div>
      <form
        className="flex gap-2 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const v = manual.trim();
          if (v) onDetect(v);
        }}
      >
        <Input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="atau ketik barcode manual…"
          inputMode="numeric"
          autoComplete="off"
          className="bg-white"
        />
        <Button type="submit">OK</Button>
      </form>
    </div>
  );
}
