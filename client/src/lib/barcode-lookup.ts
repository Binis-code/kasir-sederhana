export type BarcodeVariant = {
  variantId: number;
  productId: number;
  name: string;
  label: string;
  sellingPrice: number;
  stock: number;
};

export async function lookupBarcode(code: string): Promise<BarcodeVariant | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  try {
    const res = await fetch(`/trpc/products.byBarcode?input=${encodeURIComponent(JSON.stringify({ barcode: trimmed }))}`);
    const body = await res.json();
    const d = body?.result?.data;
    return d && d.variantId ? (d as BarcodeVariant) : null;
  } catch {
    return null;
  }
}
