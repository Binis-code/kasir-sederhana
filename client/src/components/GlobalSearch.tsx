import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "../lib/trpc.js";
import { getRecentQueries, pushRecentQuery, bumpSkuFrequency, getFrequencyMap } from "@shared/search-utils.js";
import { formatRupiah } from "@shared/money.js";
import { Button, Input, Badge, Spinner, Modal } from "./ui.js";
import { BarcodeScanner } from "./BarcodeScanner.js";
import { Search, ScanLine, Clock3, TrendingUp, PackageX } from "lucide-react";

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const recent = useMemo(() => (open ? getRecentQueries() : []), [open, submitted]);
  const freqQuery = trpc.pos.frequentSkuKeys.useQuery(undefined, { enabled: open });
  const recordPick = trpc.pos.recordPick.useMutation();
  const localFreq = useMemo(() => (open ? getFrequencyMap() : {}), [open]);

  const searchQuery = trpc.products.search.useQuery(
    { q: submitted, limit: 12 },
    { enabled: open && submitted.trim().length > 0 }
  );

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setQ(""); setSubmitted(""); }
  }, [open]);

  function pickVariant(variantId: number) {
    bumpSkuFrequency(String(variantId));
    recordPick.mutate({ variantId });
    void utils.pos.frequentSkuKeys.invalidate();
    navigate(`/pos?add=${variantId}`);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55] bg-black/40" onClick={onClose} role="dialog" aria-modal="true" aria-label="Pencarian global">
      <div className="mx-auto mt-2 w-full max-w-xl rounded-2xl bg-white shadow-2xl sm:mt-16" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} onClick={(e) => e.stopPropagation()}>
        <form
          className="flex items-center gap-2 border-b border-warm-100 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const v = q.trim();
            if (!v) return;
            pushRecentQuery(v);
            setSubmitted(v);
            setSubmitted((s) => (s === v ? s : v));
            // force re-run even same query
            if (v === submitted) searchQuery.refetch();
          }}
        >
          <Search size={18} className="shrink-0 text-gray-400" />
          <Input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); }}
            placeholder="Cari nama produk, kategori, SKU, barcode…"
            className="border-0 focus:border-0"
            aria-label="Kolom pencarian global"
          />
          <Button type="button" variant="outline" size="icon" aria-label="Pindai barcode" onClick={() => setScanOpen(true)}>
            <ScanLine size={18} />
          </Button>
        </form>

        <div className="max-h-[65vh] overflow-y-auto p-3">
          {!submitted ? (
            <div className="space-y-4">
              <Section icon={<Clock3 size={14} />} title="Terakhir dicari">
                {recent.length === 0 ? (
                  <p className="px-1 py-1 text-xs text-gray-400">Belum ada riwayat.</p>
                ) : (
                  recent.map(r => (
                    <button key={r.q + r.ts} className="block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-warm-100" onClick={() => { setQ(r.q); pushRecentQuery(r.q); setSubmitted(r.q); }}>
                      {r.q}
                    </button>
                  ))
                )}
              </Section>
              <Section icon={<TrendingUp size={14} />} title="Sering dicari">
                {freqQuery.isLoading ? <Spinner /> :
                 !freqQuery.data?.length ? (
                  <p className="px-1 py-1 text-xs text-gray-400">Belum ada data.</p>
                ) : (
                  freqQuery.data.slice(0, 6).map(f => (
                    <button key={f.variantId} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-warm-100" onClick={() => pickVariant(f.variantId)}>
                      <span>{f.name} <span className="text-xs text-gray-400">{f.label}</span></span>
                      <Badge tone="green">×{f.count}</Badge>
                    </button>
                  ))
                )}
              </Section>
              {Object.keys(localFreq).length > 0 && (
                <p className="px-1 text-[11px] text-gray-400">{Object.values(localFreq).reduce((a, b) => a + b, 0)} pemilihan tersimpan di perangkat ini</p>
              )}
            </div>
          ) : (
            <Results
              loading={searchQuery.isLoading}
              items={searchQuery.data ?? []}
              onPick={pickVariant}
              onRawSubmit={(code) => { pushRecentQuery(code); setSubmitted(code); }}
              query={submitted}
            />
          )}
        </div>
      </div>
      {scanOpen && (
        <BarcodeScanner
          onDetect={(code) => {
            setScanOpen(false);
            setQ(code);
            pushRecentQuery(code);
            setSubmitted(code);
          }}
          onClose={() => setScanOpen(false)}
        />
      )}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{icon}{title}</p>
      <div>{children}</div>
    </div>
  );
}

type SearchItem = {
  productId: number;
  name: string;
  category: string;
  barcode: string | null;
  stock: number;
  price: number;
  variant: { id: number; label: string; price: number } | null;
};

function Results({ loading, items, onPick, query }: {
  loading: boolean;
  items: SearchItem[];
  onPick: (variantId: number) => void;
  onRawSubmit: (raw: string) => void;
  query: string;
}) {
  if (loading) return <Spinner />;
  if (!items.length) {
    return (
      <EmptySearch query={query} />
    );
  }
  return (
    <ul className="divide-y divide-warm-100">
      {items.map(it => (
        <li key={`${it.productId}-${it.variant?.id ?? 0}`}>
          <button className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-warm-100" onClick={() => it.variant && onPick(it.variant.id)}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-800">{it.name}</p>
              <p className="truncate text-[11px] text-gray-500">
                {it.variant ? `${it.variant.label} · ` : ""}{it.category}{it.barcode ? ` · ${it.barcode}` : ""}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold text-brand-700">{formatRupiah(it.price)}</p>
              <Badge tone={it.stock <= 0 ? "red" : it.stock <= 10 ? "amber" : "neutral"}>
                stok {it.stock}
              </Badge>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function EmptySearch({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <PackageX size={28} className="text-warm-300" />
      <p className="text-sm font-medium text-gray-600">Tidak ada hasil untuk “{query}”</p>
      <p className="text-xs text-gray-400">Coba kata kunci lain atau scan barcode.</p>
    </div>
  );
}

// re-export Modal for scanner host convenience
export { Modal };

