import { formatRupiah } from "@shared/money.js";
import { Badge, Modal, Spinner, cn } from "../ui.js";

type Variant = {
  id: number;
  productId: number;
  label: string;
  barcode: string | null;
  sellingPrice: number;
  costPrice: number;
  stock: number;
  isActive: boolean;
};

type ProductDetail = {
  id: number;
  name: string;
  category: string;
  barcode: string | null;
  stock: number;
  minStock: number;
  variants: Variant[];
};

export function VariantPickerModal({
  open,
  onClose,
  productDetail,
  isLoading,
  onSelectVariant,
}: {
  open: boolean;
  onClose: () => void;
  productDetail?: ProductDetail | null;
  isLoading: boolean;
  onSelectVariant: (item: {
    variantId: number;
    productId: number;
    name: string;
    label: string;
    price: number;
    stock: number;
  }) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={productDetail ? `Pilih Varian: ${productDetail.name}` : "Pilih varian"}>
      {isLoading ? (
        <Spinner />
      ) : (
        <ul className="space-y-2">
          {productDetail?.variants
            ?.filter((v) => v.isActive)
            .map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  className={cn(
                    "flex min-h-[52px] w-full items-center justify-between rounded-xl border p-3.5 text-left transition-all hover:border-brand-500 active:scale-98",
                    v.stock < 1 ? "opacity-50 cursor-not-allowed bg-warm-50" : "border-warm-200 bg-white"
                  )}
                  disabled={v.stock < 1}
                  onClick={() => {
                    onSelectVariant({
                      variantId: v.id,
                      productId: v.productId,
                      name: productDetail.name,
                      label: v.label,
                      price: v.sellingPrice,
                      stock: v.stock,
                    });
                    onClose();
                  }}
                >
                  <div>
                    <span className="block text-sm font-semibold text-gray-900">{v.label}</span>
                    <span className="block text-[11px] text-gray-500">{v.barcode ?? ""}</span>
                    <Badge tone={v.stock < 1 ? "red" : v.stock <= 10 ? "amber" : "neutral"}>
                      stok {v.stock}
                    </Badge>
                  </div>
                  <span className="text-base font-bold text-brand-700">{formatRupiah(v.sellingPrice)}</span>
                </button>
              </li>
            ))}
          {productDetail && productDetail.variants?.filter((v) => v.isActive).length === 0 && (
            <p className="text-sm text-gray-500">Tidak ada varian aktif.</p>
          )}
        </ul>
      )}
    </Modal>
  );
}
