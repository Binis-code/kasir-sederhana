import { Sparkles } from "lucide-react";
import { formatRupiah } from "@shared/money.js";

type CrossSellItem = {
  variantId: number;
  productName: string;
  variantLabel: string;
  sellingPrice: number;
  stock: number;
};

export function CrossSellWidget({
  items,
  onAdd,
}: {
  items: CrossSellItem[];
  onAdd: (item: CrossSellItem) => void;
}) {
  if (!items.length) return null;

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-brand-900">
        <Sparkles size={14} className="text-brand-600" />
        <span>Sering Dibeli Bersamaan (Rekomendasi Tambahan)</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {items.map((item) => (
          <button
            key={item.variantId}
            type="button"
            onClick={() => onAdd(item)}
            className="flex min-h-[48px] items-center justify-between rounded-lg border border-brand-200 bg-white p-2.5 text-left shadow-xs transition-all hover:border-brand-500 active:scale-95"
          >
            <div className="min-w-0 pr-2">
              <p className="truncate text-xs font-semibold text-gray-800">{item.productName}</p>
              <p className="text-[10px] text-gray-500">{item.variantLabel}</p>
            </div>
            <span className="text-xs font-bold text-brand-700">{formatRupiah(item.sellingPrice)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
