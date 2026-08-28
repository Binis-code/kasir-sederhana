import { useEffect, useMemo, useRef, useState } from "react";
import { useSearch } from "wouter";
import { trpc } from "../lib/trpc.js";
import { formatRupiah, generateWhatsAppReceiptText } from "@shared/money.js";
import { calcLineTotal, applyTransactionDiscount, applyVoucher } from "@shared/money.js";
import { bumpSkuFrequency, pushRecentQuery } from "@shared/search-utils.js";
import {
  Button, Card, Input, Label, NativeSelect, Badge, Spinner, Modal,
  EmptyState, cn, toast, ErrorText
} from "../components/ui.js";
import { BarcodeScanner } from "../components/BarcodeScanner.js";
import { lookupBarcode } from "../lib/barcode-lookup.js";
import {
  Search, ScanLine, Minus, Plus, Trash2, CheckCircle2, Printer, ShoppingCart,
  PauseCircle, PlayCircle, Share2, Wallet, AlertCircle
} from "lucide-react";

type CartLine = {
  variantId: number;
  productId: number;
  name: string;
  label: string;
  price: number;
  stock: number;
  qty: number;
  discount: number;
  priceOverride: number | null;
};

type SuccessInfo = {
  saleId: number;
  invoiceNo: string;
  total: number;
  changeAmount: number;
  items: CartLine[];
  paymentMethod: string;
  paidAmount: number;
  subtotal: number;
  discountTotal: number;
};

export default function Kasir({ role }: { role?: string }) {
  const isAdmin = role === "owner" || role === "admin";
  const addParam = useSearch();
  const utils = trpc.useUtils();

  // Shift state
  const shiftQ = trpc.shifts.current.useQuery();
  const [openShiftModal, setOpenShiftModal] = useState(false);
  const [startingCashInput, setStartingCashInput] = useState("");
  const openShiftMut = trpc.shifts.open.useMutation({
    onSuccess: () => {
      toast("Shift kasir berhasil dibuka");
      setOpenShiftModal(false);
      void shiftQ.refetch();
    },
    onError: (e) => toast(e.message, "err"),
  });

  // Catalog
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  const productsQ = trpc.products.list.useQuery({ q: debouncedQ || undefined, limit: 60 });

  // Variant picker modal (multi-variant product)
  const [pickProduct, setPickProduct] = useState<number | null>(null);
  const detailQ = trpc.products.get.useQuery({ id: pickProduct! }, { enabled: pickProduct !== null });

  // Cart state
  const [cart, setCart] = useState<CartLine[]>([]);
  const [activeHeldCartId, setActiveHeldCartId] = useState<number | null>(null);
  const [trxType, setTrxType] = useState<"fixed" | "percentage" | "">("");
  const [trxValue, setTrxValue] = useState(0);
  const [voucherInput, setVoucherInput] = useState("");
  const [voucher, setVoucher] = useState<{ code: string; discount: number } | null>(null);
  const [method, setMethod] = useState<"cash" | "qris" | "debit" | "kredit">("cash");
  const [paid, setPaid] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const [waPhone, setWaPhone] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const cartRef = useRef(cart);
  cartRef.current = cart;

  // Held carts state
  const [heldModalOpen, setHeldModalOpen] = useState(false);
  const [holdLabelInput, setHoldLabelInput] = useState("");
  const [holdConfirmOpen, setHoldConfirmOpen] = useState(false);
  const heldCartsQ = trpc.pos.listHeldCarts.useQuery();

  const holdCartMut = trpc.pos.holdCart.useMutation({
    onSuccess: () => {
      toast("Keranjang berhasil ditahan");
      resetCart();
      setHoldConfirmOpen(false);
      void heldCartsQ.refetch();
    },
    onError: (e) => toast(e.message, "err"),
  });

  const deleteHeldCartMut = trpc.pos.deleteHeldCart.useMutation({
    onSuccess: () => {
      toast("Keranjang tertahan dihapus");
      void heldCartsQ.refetch();
    },
  });

  function addToCart(item: { variantId: number; productId: number; name: string; label: string; price: number; stock: number }) {
    setErr(null);
    setCart(prev => {
      const idx = prev.findIndex(l => l.variantId === item.variantId);
      if (idx >= 0) {
        const next = [...prev];
        if (next[idx].qty + 1 > item.stock) {
          toast(`Stok ${item.name} tidak cukup`, "err");
          return prev;
        }
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      if (item.stock < 1) {
        toast(`Stok ${item.name} habis`, "err");
        return prev;
      }
      return [...prev, { ...item, qty: 1, discount: 0, priceOverride: null }];
    });
    bumpSkuFrequency(String(item.variantId));
  }

  // Deep link /pos?add=variantId
  const handledAdd = useRef<string>("");
  const addVariantId = useMemo(() => {
    const m = /(?:^|[?&])add=(\d+)/.exec(addParam ?? "");
    return m ? Number(m[1]) : 0;
  }, [addParam]);
  const variantDetail = trpc.pos.variantDetail.useQuery(
    { variantId: addVariantId },
    { enabled: addVariantId > 0 }
  );
  useEffect(() => {
    if (addVariantId <= 0 || handledAdd.current === String(addVariantId)) return;
    const v = variantDetail.data;
    if (v && v.variantId > 0) {
      void recordPick.mutateAsync({ variantId: v.variantId }).catch(() => undefined);
      addToCart({ variantId: v.variantId, productId: v.productId, name: v.productName, label: v.label, price: v.sellingPrice, stock: v.stock });
      handledAdd.current = String(addVariantId);
      window.history.replaceState({}, "", "/pos");
    }
  }, [addVariantId, variantDetail.data]);

  // Barcode scan → lookup
  async function handleBarcode(code: string) {
    pushRecentQuery(code);
    const data = await lookupBarcode(code);
    if (!data) {
      toast(`Barcode ${code} tidak ditemukan`, "err");
      return;
    }
    void recordPick.mutateAsync({ variantId: data.variantId }).catch(() => undefined);
    addToCart({ variantId: data.variantId, productId: data.productId, name: data.name, label: data.label, price: data.sellingPrice, stock: data.stock });
    toast(`${data.name} ditambahkan`);
  }

  // Totals calculation
  const effPrice = (l: CartLine) => l.priceOverride ?? l.price;
  const subtotal = useMemo(() => cart.reduce((s, l) => s + effPrice(l) * l.qty, 0), [cart]);
  const itemDiscTotal = useMemo(() => cart.reduce((s, l) => s + Math.min(l.discount, effPrice(l) * l.qty), 0), [cart]);
  const afterItem = subtotal - itemDiscTotal;
  const trxDisc = trxType ? applyTransactionDiscount(afterItem, trxType, trxValue) : 0;
  const afterTrx = Math.max(0, afterItem - trxDisc);
  const voucherDisc = voucher ? applyVoucher(afterTrx, "fixed", voucher.discount, 0).discount : 0;
  const total = Math.max(0, afterTrx - voucherDisc);
  const change = Math.max(0, paid - total);
  const unpaid = total - Math.min(paid, total);
  const needsCredit = unpaid > 0;

  const checkout = trpc.pos.checkout.useMutation({
    onSuccess: (res) => {
      for (const l of cartRef.current) bumpSkuFrequency(String(l.variantId));
      setSuccess({
        ...res,
        items: [...cartRef.current],
        paymentMethod: method,
        paidAmount: paid,
        subtotal,
        discountTotal: itemDiscTotal + trxDisc + voucherDisc,
      });
      resetCart();
      void utils.dashboard.summary.invalidate();
      void heldCartsQ.refetch();
    },
    onError: (e) => setErr(e.message),
  });
  const recordPick = trpc.pos.recordPick.useMutation();

  function resetCart() {
    setCart([]);
    setActiveHeldCartId(null);
    setTrxType(""); setTrxValue(0); setVoucherInput(""); setVoucher(null);
    setMethod("cash"); setPaid(0); setCustomerName(""); setDueDate(""); setErr(null);
  }

  async function validateVoucher() {
    const code = voucherInput.trim();
    if (!code) return;
    try {
      const d = await utils.pos.validateVoucher.fetch({ code, subtotal: afterTrx });
      if (d.valid) {
        setVoucher({ code: d.code, discount: d.discount });
        toast(`Voucher ${d.code} dipakai (-${formatRupiah(d.discount)})`);
      } else {
        setVoucher(null);
        toast(d.reason ?? "Voucher tidak valid", "err");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal memvalidasi voucher";
      toast(msg, "err");
    }
  }

  function handleHoldCurrentCart() {
    if (!cart.length) return toast("Keranjang kosong, tidak ada yang ditahan", "err");
    const d = new Date();
    const defaultLabel = `Pelanggan ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")} (${cart.length} item)`;
    setHoldLabelInput(defaultLabel);
    setHoldConfirmOpen(true);
  }

  function confirmHoldCart() {
    holdCartMut.mutate({
      label: holdLabelInput.trim() || "Keranjang Ditahan",
      cartJson: JSON.stringify(cart),
      subtotal: total,
    });
  }

  function restoreHeldCart(held: { id: number; label: string; cartJson: string }) {
    try {
      const restoredItems = JSON.parse(held.cartJson) as CartLine[];
      setCart(restoredItems);
      setActiveHeldCartId(held.id);
      setHeldModalOpen(false);
      toast(`Keranjang "${held.label}" dimuat kembali`);
    } catch {
      toast("Gagal memuat keranjang tertahan", "err");
    }
  }

  function submitCheckout() {
    setErr(null);
    if (!cart.length) return setErr("Keranjang kosong");
    checkout.mutate({
      items: cart.map(l => ({
        variantId: l.variantId,
        qty: l.qty,
        discount: Math.min(l.discount, effPrice(l) * l.qty),
        ...(l.priceOverride != null && l.priceOverride !== l.price ? { unitPrice: l.priceOverride } : {}),
      })),
      trxDiscountType: trxType || null,
      trxDiscountValue: trxValue,
      voucherCode: voucher?.code ?? null,
      paymentMethod: method,
      paidAmount: method === "cash" ? paid : (needsCredit ? paid : total),
      customerName: customerName || null,
      dueDate: dueDate || null,
      heldCartId: activeHeldCartId,
    });
  }

  function shareWhatsApp() {
    if (!success) return;
    const cleanPhone = waPhone.replace(/\D/g, "").replace(/^0/, "62");
    if (!cleanPhone) {
      toast("Masukkan nomor WhatsApp pelanggan (misal: 0812xxxx)", "err");
      return;
    }
    const receiptText = generateWhatsAppReceiptText({
      storeName: "Kios Nusa",
      invoiceNo: success.invoiceNo,
      dateStr: new Date().toLocaleString("id-ID"),
      cashierName: "Kasir Kios Nusa",
      items: success.items.map(i => ({
        name: `${i.name} (${i.label})`,
        qty: i.qty,
        unitPrice: effPrice(i),
        lineTotal: calcLineTotal(i.qty, effPrice(i), i.discount),
      })),
      subtotal: success.subtotal,
      discountTotal: success.discountTotal,
      total: success.total,
      paymentMethod: success.paymentMethod,
      paidAmount: success.paidAmount,
      changeAmount: success.changeAmount,
    });

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(receiptText)}`;
    window.open(url, "_blank");
  }

  const heldCount = heldCartsQ.data?.length ?? 0;

  return (
    <div className="flex flex-col gap-4 p-4 lg:h-[calc(100vh-3.5rem)] lg:flex-row lg:overflow-hidden">
      {/* Shift status banner */}
      {shiftQ.data === null && (
        <div className="flex w-full items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-amber-800 lg:hidden">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} />
            <span className="text-xs font-semibold">Shift kasir belum aktif</span>
          </div>
          <Button size="sm" onClick={() => setOpenShiftModal(true)}>Buka Shift</Button>
        </div>
      )}

      {/* LEFT: catalog */}
      <section className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk untuk keranjang…" className="pl-9" aria-label="Cari produk" />
          </div>
          <Button variant="outline" size="icon" aria-label="Scan barcode" onClick={() => setScanOpen(true)}><ScanLine size={18} /></Button>

          {/* Held Carts Badge Button */}
          <Button
            variant={heldCount > 0 ? "default" : "outline"}
            className="relative"
            onClick={() => setHeldModalOpen(true)}
            title="Daftar Keranjang Tertahan"
          >
            <PauseCircle size={16} />
            <span className="hidden sm:inline">Parkir</span>
            {heldCount > 0 && (
              <span className="ml-1 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-gray-900">
                {heldCount}
              </span>
            )}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {productsQ.isLoading ? <Spinner /> :
           !productsQ.data?.items.length ? (
            <EmptyState icon={<ShoppingCart size={28} />} title={q ? `Tidak ada produk “${q}”` : "Belum ada produk"} description="Tambahkan produk lewat menu Produk." />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {productsQ.data.items.map(p => (
                <button key={p.id}
                  onClick={() => setPickProduct(p.id)}
                  className="flex min-h-[88px] flex-col justify-between rounded-xl border border-warm-200 bg-white p-3 text-left shadow-sm hover:border-brand-400"
                >
                  <div>
                    <p className="line-clamp-2 text-sm font-semibold text-gray-800">{p.name}</p>
                    <p className="text-[11px] text-gray-500">{p.category}{p.barcode ? ` · ${p.barcode}` : ""}</p>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <Badge tone={p.stock <= p.minStock ? "amber" : "neutral"}>stok {p.stock}</Badge>
                    <span className="text-[10px] text-brand-700">pilih varian ›</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* RIGHT: cart */}
      <section className="flex w-full shrink-0 flex-col lg:w-[390px]">
        <Card className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-warm-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-gray-800">
                Keranjang ({cart.length} item)
              </h2>
              {activeHeldCartId && (
                <span className="text-[11px] font-medium text-amber-700">(Melanjutkan keranjang tertahan)</span>
              )}
            </div>

            {cart.length > 0 && !success && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleHoldCurrentCart}
                title="Tahan keranjang sementara untuk melayani pelanggan lain"
              >
                <PauseCircle size={13} /> Tahan (Hold)
              </Button>
            )}
          </div>

          {success ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <CheckCircle2 size={44} className="text-green-600" />
              <p className="text-base font-bold text-gray-900">Transaksi berhasil</p>
              <p className="text-sm text-gray-600">{success.invoiceNo} · Total {formatRupiah(success.total)}</p>
              {success.changeAmount > 0 && <p className="text-sm text-brand-700">Kembalian {formatRupiah(success.changeAmount)}</p>}

              {/* WhatsApp Share Card */}
              <div className="mt-1 flex w-full max-w-xs flex-col gap-1.5 rounded-lg border border-warm-200 bg-warm-50 p-2.5 text-left">
                <Label className="text-xs font-semibold text-gray-700">Kirim Struk ke WhatsApp</Label>
                <div className="flex gap-1.5">
                  <Input
                    placeholder="0812xxxx"
                    className="h-8 text-xs"
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                  />
                  <Button size="sm" className="h-8 shrink-0 bg-green-600 text-white hover:bg-green-700" onClick={shareWhatsApp}>
                    <Share2 size={13} /> Kirim
                  </Button>
                </div>
              </div>

              <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
                <a href={`/receipt/${success.saleId}`}>
                  <Button size="lg" className="w-full"><Printer size={16} /> Cetak struk</Button>
                </a>
                <Button variant="outline" size="lg" className="w-full" onClick={() => setSuccess(null)}>Transaksi baru</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="min-h-[120px] flex-1 overflow-y-auto divide-y divide-warm-100">
                {!cart.length ? (
                  <EmptyState icon={<ShoppingCart size={24} />} title="Keranjang kosong" description="Pilih produk atau scan barcode." />
                ) : cart.map((l, i) => (
                  <div key={l.variantId} className="px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-800">{l.name}</p>
                        <p className="text-[11px] text-gray-500">{l.label}{!isAdmin ? ` · ${formatRupiah(l.price)}` : ""}</p>
                      </div>
                      <button aria-label={`Hapus ${l.name}`} className="rounded p-1 text-gray-400 hover:text-red-600" onClick={() => setCart(c => c.filter(x => x.variantId !== l.variantId))}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-2">
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Kurangi jumlah" disabled={l.qty <= 1}
                          onClick={() => setCart(c => c.map((x, xi) => xi === i ? { ...x, qty: Math.max(1, x.qty - 1) } : x))}><Minus size={13} /></Button>
                        <Input inputMode="numeric" className="h-8 w-12 px-1 text-center text-sm font-semibold" value={l.qty}
                          aria-label={`Jumlah ${l.name}`}
                          onChange={(e) => {
                            const n = Number(e.target.value.replace(/\D/g, "")) || 0;
                            if (n > l.stock) toast(`Stok ${l.name} hanya ${l.stock}`, "err");
                            setCart(c => c.map((x, xi) => xi === i ? { ...x, qty: Math.min(Math.max(n, 1), l.stock) } : x));
                          }} />
                        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Tambah jumlah"
                          onClick={() => {
                            if (l.qty + 1 > l.stock) { toast("Stok tidak cukup", "err"); return; }
                            setCart(c => c.map((x, xi) => xi === i ? { ...x, qty: x.qty + 1 } : x));
                          }}><Plus size={13} /></Button>
                      </div>

                      {isAdmin && (
                        <label className="flex items-center gap-1">
                          <Label className="mb-0">Harga</Label>
                          <Input inputMode="numeric" className="h-8 w-24 text-right" value={effPrice(l) || ""}
                            aria-label={`Harga ${l.name}`}
                            onChange={(e) => {
                              const n = Number(e.target.value.replace(/\D/g, "")) || 0;
                              setCart(c => c.map((x, xi) => xi === i ? { ...x, priceOverride: n } : x));
                            }} />
                        </label>
                      )}

                      <label className="flex items-center gap-1">
                        <Label className="mb-0">Disk</Label>
                        <Input inputMode="numeric" className="h-8 w-20 text-right" value={l.discount || ""}
                          aria-label={`Diskon ${l.name}`}
                          onChange={(e) => {
                            const n = Number(e.target.value.replace(/\D/g, "")) || 0;
                            setCart(c => c.map((x, xi) => xi === i ? { ...x, discount: n } : x));
                          }} />
                      </label>

                      <span className="ml-auto w-24 text-right text-sm font-semibold">{formatRupiah(calcLineTotal(l.qty, effPrice(l), l.discount))}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals & payment */}
              <div className="space-y-2.5 border-t border-warm-100 px-3 py-3">
                <Row k="Subtotal" v={formatRupiah(subtotal)} />
                {itemDiscTotal > 0 && <Row k="Diskon item" v={`-${formatRupiah(itemDiscTotal)}`} />}

                <div className="flex items-center gap-1.5">
                  <NativeSelect className="h-8 w-28" value={trxType} onChange={(e) => setTrxType(e.target.value as typeof trxType)} aria-label="Jenis diskon transaksi">
                    <option value="">Diskon trx…</option>
                    <option value="fixed">Rp</option>
                    <option value="percentage">%</option>
                  </NativeSelect>
                  {trxType && (
                    <Input inputMode="numeric" className="h-8 w-24 text-right" value={trxValue || ""}
                      onChange={(e) => setTrxValue(Number(e.target.value.replace(/\D/g, "")) || 0)} aria-label="Nilai diskon transaksi" />
                  )}
                  <span className="ml-auto text-xs font-medium">{trxDisc > 0 ? `-${formatRupiah(trxDisc)}` : ""}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Input className="h-8 flex-1 uppercase" placeholder="Kode voucher" value={voucherInput} onChange={(e) => setVoucherInput(e.target.value.toUpperCase())} aria-label="Kode voucher" />
                  <Button size="sm" variant="outline" className="h-8" onClick={() => void validateVoucher()}>Pakai</Button>
                  {voucher && (
                    <button className="text-xs text-red-600 underline" onClick={() => { setVoucher(null); setVoucherInput(""); }}>hapus</button>
                  )}
                </div>
                {voucher && <Row k={`Voucher ${voucher.code}`} v={`-${formatRupiah(voucherDisc)}`} strong />}

                <div className="flex justify-between border-t border-dashed border-warm-200 pt-2 text-base font-bold">
                  <span>TOTAL</span><span className="text-brand-700">{formatRupiah(total)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Metode bayar</Label>
                    <NativeSelect value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                      <option value="cash">Cash</option>
                      <option value="qris">QRIS</option>
                      <option value="debit">Debit</option>
                      <option value="kredit">Kredit (piutang)</option>
                    </NativeSelect>
                  </div>
                  <div>
                    <Label>Dibayar</Label>
                    <Input inputMode="numeric" value={paid || ""} onChange={(e) => setPaid(Number(e.target.value.replace(/\D/g, "")) || 0)} placeholder="0" />
                  </div>
                </div>

                {method === "cash" && (
                  <div className="flex flex-wrap gap-1.5">
                    <QuickAmt label="Pas" onClick={() => setPaid(total)} />
                    <QuickAmt label="+10rb" onClick={() => setPaid(p => p + 10_000)} />
                    <QuickAmt label="+50rb" onClick={() => setPaid(p => p + 50_000)} />
                    <QuickAmt label="+100rb" onClick={() => setPaid(p => p + 100_000)} />
                    <QuickAmt label="Reset" onClick={() => setPaid(0)} muted />
                  </div>
                )}

                <Row k="Kembalian" v={formatRupiah(change)} />

                {(needsCredit || method === "kredit") && (
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-amber-50 p-2">
                    <div>
                      <Label>Nama pelanggan *</Label>
                      <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Wajib" />
                    </div>
                    <div>
                      <Label>Jatuh tempo *</Label>
                      <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </div>
                    <p className="col-span-2 text-[11px] text-amber-700">Piutang {formatRupiah(unpaid)} akan dicatat.</p>
                  </div>
                )}

                <ErrorText message={err} />
                <Button size="lg" className="min-h-[48px] w-full" disabled={!cart.length || checkout.isPending} onClick={submitCheckout}>
                  {checkout.isPending ? "Memproses…" : needsCredit ? "Simpan & catat piutang" : `Bayar ${formatRupiah(total)}`}
                </Button>
              </div>
            </>
          )}
        </Card>
      </section>

      {/* Held Carts Modal */}
      <Modal open={heldModalOpen} onClose={() => setHeldModalOpen(false)} title="Keranjang Tertahan (Parkir)">
        <div className="space-y-3">
          {heldCartsQ.isLoading ? <Spinner /> :
           !heldCartsQ.data?.length ? (
            <EmptyState icon={<PauseCircle size={28} />} title="Tidak ada keranjang tertahan" description="Gunakan tombol 'Tahan' di keranjang untuk memarkir pesanan." />
          ) : (
            <ul className="space-y-2">
              {heldCartsQ.data.map(h => (
                <li key={h.id} className="flex items-center justify-between rounded-lg border border-warm-200 bg-white p-3 shadow-sm">
                  <div>
                    <p className="font-semibold text-gray-800">{h.label}</p>
                    <p className="text-xs text-gray-500">
                      Total: <span className="font-bold text-brand-700">{formatRupiah(h.subtotal)}</span> · {new Date(h.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => restoreHeldCart(h)}>
                      <PlayCircle size={14} /> Muat
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => deleteHeldCartMut.mutate({ id: h.id })}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

      {/* Hold Cart Confirmation Modal */}
      <Modal open={holdConfirmOpen} onClose={() => setHoldConfirmOpen(false)} title="Tahan Keranjang">
        <div className="space-y-3">
          <div>
            <Label>Label / Catatan Penanda</Label>
            <Input
              value={holdLabelInput}
              onChange={(e) => setHoldLabelInput(e.target.value)}
              placeholder="Contoh: Meja 3 / Bapak Jaket Hitam"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setHoldConfirmOpen(false)}>Batal</Button>
            <Button onClick={confirmHoldCart}>Simpan & Kosongkan Keranjang</Button>
          </div>
        </div>
      </Modal>

      {/* Open Shift Modal */}
      <Modal open={openShiftModal} onClose={() => setOpenShiftModal(false)} title="Buka Shift Kasir Baru">
        <div className="space-y-3">
          <div>
            <Label>Modal Awal di Laci Kas (Cash Drawer)</Label>
            <Input
              inputMode="numeric"
              value={startingCashInput}
              onChange={(e) => setStartingCashInput(e.target.value.replace(/\D/g, ""))}
              placeholder="Contoh: 200000"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpenShiftModal(false)}>Nanti Saja</Button>
            <Button onClick={() => openShiftMut.mutate({ startingCash: Number(startingCashInput) || 0 })}>
              <Wallet size={15} /> Buka Shift Sekarang
            </Button>
          </div>
        </div>
      </Modal>

      {/* Variant picker */}
      <Modal open={pickProduct !== null} onClose={() => setPickProduct(null)} title="Pilih varian">
        {detailQ.isLoading ? <Spinner /> : (
          <ul className="space-y-2">
            {detailQ.data?.variants.filter(v => v.isActive).map(v => (
              <li key={v.id}>
                <button
                  className={cn("flex w-full items-center justify-between rounded-lg border p-3 text-left hover:border-brand-500",
                    v.stock < 1 ? "opacity-50" : "border-warm-200")}
                  disabled={v.stock < 1}
                  onClick={() => {
                    addToCart({ variantId: v.id, productId: v.productId, name: detailQ.data!.name, label: v.label, price: v.sellingPrice, stock: v.stock });
                    setPickProduct(null);
                  }}>
                  <span>
                    <span className="block text-sm font-medium">{v.label}</span>
                    <span className="block text-[11px] text-gray-500">{v.barcode ?? ""}</span>
                    <Badge tone={v.stock < 1 ? "red" : v.stock <= 10 ? "amber" : "neutral"}>stok {v.stock}</Badge>
                  </span>
                  <span className="text-sm font-bold text-brand-700">{formatRupiah(v.sellingPrice)}</span>
                </button>
              </li>
            ))}
            {detailQ.data && detailQ.data.variants.filter(v => v.isActive).length === 0 && (
              <p className="text-sm text-gray-500">Tidak ada varian aktif.</p>
            )}
          </ul>
        )}
      </Modal>

      {scanOpen && (
        <BarcodeScanner
          onDetect={(code) => { setScanOpen(false); void handleBarcode(code); }}
          onClose={() => setScanOpen(false)}
        />
      )}
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between text-sm", strong ? "font-bold text-gray-900" : "text-gray-600")}>
      <span>{k}</span><span>{v}</span>
    </div>
  );
}

function QuickAmt({ label, onClick, muted }: { label: string; onClick: () => void; muted?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("min-h-[32px] rounded-full border px-3 text-xs font-medium",
        muted ? "border-warm-200 text-gray-500" : "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100")}>
      {label}
    </button>
  );
}
