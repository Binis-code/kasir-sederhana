import { useEffect, useMemo, useRef, useState } from "react";
import { useSearch } from "wouter";
import { trpc } from "../lib/trpc.js";
import { formatRupiah, generateWhatsAppReceiptText } from "@shared/money.js";
import { calcLineTotal, applyTransactionDiscount, applyVoucher } from "@shared/money.js";
import { bumpSkuFrequency, pushRecentQuery } from "@shared/search-utils.js";
import { broadcastCustomerDisplay, getCashDrawerKickCommand } from "../lib/escpos.js";
import {
  Button, Card, Input, Label, NativeSelect, Badge, Spinner, Modal,
  EmptyState, cn, toast, ErrorText
} from "../components/ui.js";
import { BarcodeScanner } from "../components/BarcodeScanner.js";
import { lookupBarcode } from "../lib/barcode-lookup.js";
import {
  Search, ScanLine, Minus, Plus, Trash2, CheckCircle2, Printer, ShoppingCart,
  PauseCircle, Share2, AlertCircle, Tv, Keyboard, LockOpen
} from "lucide-react";

import { CrossSellWidget } from "../components/pos/CrossSellWidget.js";
import { HeldCartsModal, type HeldCartRecord } from "../components/pos/HeldCartsModal.js";
import { OpenShiftModal } from "../components/pos/OpenShiftModal.js";
import { VariantPickerModal } from "../components/pos/VariantPickerModal.js";

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
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    onError: (e: { message: string }) => toast(e.message, "err"),
  });

  // Catalog state
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  const productsQ = trpc.products.list.useQuery({ q: debouncedQ || undefined, limit: 60 });

  // Variant picker modal
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
    onError: (e: { message: string }) => toast(e.message, "err"),
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

  // Cross-sell recommendations
  const cartVariantIds = useMemo(() => cart.map(c => c.variantId), [cart]);
  const crossSellQ = trpc.analytics.crossSellSuggestions.useQuery(
    { variantIds: cartVariantIds },
    { enabled: cartVariantIds.length > 0 }
  );

  // Broadcast to Customer Display
  useEffect(() => {
    broadcastCustomerDisplay({
      items: cart.map(c => ({
        name: `${c.name} (${c.label})`,
        qty: c.qty,
        price: effPrice(c),
        lineTotal: calcLineTotal(c.qty, effPrice(c), c.discount),
      })),
      subtotal,
      discountTotal: itemDiscTotal + trxDisc + voucherDisc,
      total,
      paymentMethod: method,
      isSuccess: false,
    });
  }, [cart, subtotal, itemDiscTotal, trxDisc, voucherDisc, total, method]);

  // POS Keyboard Hotkeys (F2, F4, F6, F8, F9)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "F4") {
        e.preventDefault();
        setPaid(total);
        toast(`Bayar pas ${formatRupiah(total)} diisi`);
      } else if (e.key === "F6") {
        e.preventDefault();
        if (cart.length > 0) {
          handleHoldCurrentCart();
        } else if (heldCartsQ.data?.length) {
          setHeldModalOpen(true);
        }
      } else if (e.key === "F8") {
        e.preventDefault();
        triggerCashDrawer();
      } else if (e.key === "F9") {
        e.preventDefault();
        if (cart.length > 0 && confirm("Kosongkan keranjang saat ini?")) {
          resetCart();
          toast("Keranjang dikosongkan");
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [total, cart, heldCartsQ.data]);

  function triggerCashDrawer() {
    getCashDrawerKickCommand();
    toast("Sinyal buka laci kas (ESC p 0 25 250) dikirim");
  }

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
      broadcastCustomerDisplay({
        items: [...cartRef.current].map(c => ({
          name: `${c.name} (${c.label})`,
          qty: c.qty,
          price: effPrice(c),
          lineTotal: calcLineTotal(c.qty, effPrice(c), c.discount),
        })),
        subtotal,
        discountTotal: itemDiscTotal + trxDisc + voucherDisc,
        total: res.total,
        paymentMethod: method,
        isSuccess: true,
        invoiceNo: res.invoiceNo,
        changeAmount: res.changeAmount,
      });
      resetCart();
      void utils.dashboard.summary.invalidate();
      void heldCartsQ.refetch();
    },
    onError: (e: { message: string }) => setErr(e.message),
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

  function restoreHeldCart(held: HeldCartRecord) {
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
      {/* Shift alert banner */}
      {shiftQ.data === null && (
        <div className="flex w-full items-center justify-between rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 lg:hidden">
          <div className="flex items-center gap-2">
            <AlertCircle size={20} className="text-amber-600 shrink-0" />
            <span className="text-xs font-bold">Shift kasir belum dibuka hari ini</span>
          </div>
          <Button size="sm" className="min-h-[44px]" onClick={() => setOpenShiftModal(true)}>
            Buka Shift
          </Button>
        </div>
      )}

      {/* LEFT: Catalog and Cross-Sell */}
      <section className="flex min-h-0 flex-1 flex-col gap-3">
        {/* Hotkeys Legend Bar */}
        <div className="hidden items-center justify-between rounded-xl border border-warm-200 bg-warm-50/80 px-3 py-1.5 text-[11px] text-gray-600 sm:flex">
          <span className="flex items-center gap-1 font-semibold text-gray-800">
            <Keyboard size={13} className="text-brand-600" /> Pintasan POS:
          </span>
          <div className="flex items-center gap-3">
            <span><kbd className="rounded border border-warm-300 bg-white px-1 font-bold">F2</kbd> Cari</span>
            <span><kbd className="rounded border border-warm-300 bg-white px-1 font-bold">F4</kbd> Bayar Pas</span>
            <span><kbd className="rounded border border-warm-300 bg-white px-1 font-bold">F6</kbd> Parkir</span>
            <span><kbd className="rounded border border-warm-300 bg-white px-1 font-bold">F8</kbd> Buka Laci</span>
            <span><kbd className="rounded border border-warm-300 bg-white px-1 font-bold">F9</kbd> Reset</span>
          </div>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              ref={searchInputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari produk / varian (F2)…"
              className="h-11 pl-10 text-sm font-medium"
              aria-label="Cari produk"
            />
          </div>
          <Button
            variant="outline"
            className="h-11 w-11 shrink-0 p-0"
            aria-label="Scan barcode"
            onClick={() => setScanOpen(true)}
            title="Scan Barcode Kamera"
          >
            <ScanLine size={20} />
          </Button>

          {/* Customer Display Button */}
          <Button
            variant="outline"
            className="h-11 w-11 shrink-0 p-0"
            onClick={() => window.open("/display", "customer_display", "width=1024,height=768")}
            title="Buka Layar Pelanggan (Dual Display)"
          >
            <Tv size={20} />
          </Button>

          {/* Trigger Drawer Kick */}
          <Button
            variant="outline"
            className="h-11 w-11 shrink-0 p-0"
            onClick={triggerCashDrawer}
            title="Buka Laci Kas Manual (F8)"
          >
            <LockOpen size={18} />
          </Button>

          {/* Held Carts Badge Button */}
          <Button
            variant={heldCount > 0 ? "default" : "outline"}
            className="relative h-11 shrink-0 px-3"
            onClick={() => setHeldModalOpen(true)}
            title="Daftar Keranjang Tertahan (F6)"
          >
            <PauseCircle size={18} />
            <span className="hidden sm:inline">Parkir</span>
            {heldCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-gray-950">
                {heldCount}
              </span>
            )}
          </Button>
        </div>

        {/* Product Catalog Grid */}
        <div className="min-h-0 flex-1 overflow-y-auto space-y-3 pr-1">
          {productsQ.isLoading ? (
            <Spinner />
          ) : !productsQ.data?.items.length ? (
            <EmptyState
              icon={<ShoppingCart size={28} />}
              title={q ? `Tidak ada produk “${q}”` : "Belum ada produk"}
              description="Tambahkan produk lewat menu Produk atau gunakan Import CSV."
            />
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
              {productsQ.data.items.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPickProduct(p.id)}
                  className="flex min-h-[96px] flex-col justify-between rounded-2xl border border-warm-200 bg-white p-3.5 text-left shadow-xs transition-all hover:border-brand-500 hover:shadow-sm active:scale-98"
                >
                  <div>
                    <p className="line-clamp-2 text-sm font-bold text-gray-900">{p.name}</p>
                    <p className="text-[11px] text-gray-500">{p.category}{p.barcode ? ` · ${p.barcode}` : ""}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <Badge tone={p.stock <= p.minStock ? "amber" : "neutral"}>stok {p.stock}</Badge>
                    <span className="text-xs font-semibold text-brand-700">Pilih varian ›</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* AI Cross-Sell Suggestions */}
          <CrossSellWidget
            items={crossSellQ.data ?? []}
            onAdd={(item) => {
              addToCart({
                variantId: item.variantId,
                productId: 0,
                name: item.productName,
                label: item.variantLabel,
                price: item.sellingPrice,
                stock: item.stock,
              });
              toast(`${item.productName} ditambahkan`);
            }}
          />
        </div>
      </section>

      {/* RIGHT: Cart and Payment */}
      <section className="flex w-full shrink-0 flex-col lg:w-[410px]">
        <Card className="flex min-h-0 flex-1 flex-col shadow-sm">
          <div className="flex items-center justify-between border-b border-warm-100 px-4 py-3.5">
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                Keranjang Belanja ({cart.length} item)
              </h2>
              {activeHeldCartId && (
                <span className="text-[11px] font-semibold text-amber-700">● Melanjutkan keranjang tertahan</span>
              )}
            </div>

            {cart.length > 0 && !success && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[36px] text-xs font-medium"
                  onClick={handleHoldCurrentCart}
                  title="Tahan keranjang sementara (F6)"
                >
                  <PauseCircle size={14} /> Tahan (F6)
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-[36px] px-2 text-xs text-red-600 hover:bg-red-50"
                  onClick={() => {
                    if (confirm("Kosongkan keranjang?")) resetCart();
                  }}
                  title="Kosongkan keranjang (F9)"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            )}
          </div>

          {success ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center animate-fade-in">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600">
                <CheckCircle2 size={40} />
              </div>
              <p className="text-lg font-black text-gray-900">Transaksi Berhasil</p>
              <p className="text-sm text-gray-600">{success.invoiceNo} · Total {formatRupiah(success.total)}</p>
              {success.changeAmount > 0 && (
                <p className="text-base font-bold text-brand-700">
                  Kembalian: {formatRupiah(success.changeAmount)}
                </p>
              )}

              {/* WhatsApp Share Card */}
              <div className="mt-2 flex w-full max-w-xs flex-col gap-1.5 rounded-xl border border-warm-200 bg-warm-50 p-3 text-left">
                <Label className="text-xs font-bold text-gray-800">Kirim Struk ke WhatsApp</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="0812xxxx"
                    className="h-10 text-xs"
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                  />
                  <Button size="sm" className="min-h-[40px] shrink-0 bg-green-600 text-white hover:bg-green-700" onClick={shareWhatsApp}>
                    <Share2 size={14} /> Kirim WA
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex w-full max-w-xs flex-col gap-2">
                <a href={`/receipt/${success.saleId}`}>
                  <Button size="lg" className="min-h-[48px] w-full"><Printer size={18} /> Cetak Struk Thermal</Button>
                </a>
                <Button variant="outline" size="lg" className="min-h-[48px] w-full" onClick={() => setSuccess(null)}>
                  Transaksi Baru
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Line Items List */}
              <div className="min-h-[140px] flex-1 overflow-y-auto divide-y divide-warm-100">
                {!cart.length ? (
                  <EmptyState icon={<ShoppingCart size={28} />} title="Keranjang kosong" description="Pilih produk di sebelah kiri atau scan barcode." />
                ) : (
                  cart.map((l, i) => (
                    <div key={l.variantId} className="px-3.5 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-gray-900">{l.name}</p>
                          <p className="text-[11px] text-gray-500">{l.label}{!isAdmin ? ` · ${formatRupiah(l.price)}` : ""}</p>
                        </div>
                        <button
                          aria-label={`Hapus ${l.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
                          onClick={() => setCart((c) => c.filter((x) => x.variantId !== l.variantId))}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-2">
                        {/* 48px Ergonomic Stepper */}
                        <div className="flex items-center gap-1 rounded-lg border border-warm-200 bg-warm-50 p-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-md"
                            aria-label="Kurangi jumlah"
                            disabled={l.qty <= 1}
                            onClick={() => setCart((c) => c.map((x, xi) => (xi === i ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))}
                          >
                            <Minus size={14} />
                          </Button>
                          <Input
                            inputMode="numeric"
                            className="h-9 w-12 border-0 bg-transparent px-1 text-center text-sm font-extrabold text-gray-900 focus:ring-0"
                            value={l.qty}
                            aria-label={`Jumlah ${l.name}`}
                            onChange={(e) => {
                              const n = Number(e.target.value.replace(/\D/g, "")) || 0;
                              if (n > l.stock) toast(`Stok ${l.name} hanya ${l.stock}`, "err");
                              setCart((c) => c.map((x, xi) => (xi === i ? { ...x, qty: Math.min(Math.max(n, 1), l.stock) } : x)));
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-md"
                            aria-label="Tambah jumlah"
                            onClick={() => {
                              if (l.qty + 1 > l.stock) { toast("Stok tidak cukup", "err"); return; }
                              setCart((c) => c.map((x, xi) => (xi === i ? { ...x, qty: x.qty + 1 } : x)));
                            }}
                          >
                            <Plus size={14} />
                          </Button>
                        </div>

                        {isAdmin && (
                          <label className="flex items-center gap-1 text-xs">
                            <span className="text-gray-500">Harga</span>
                            <Input
                              inputMode="numeric"
                              className="h-9 w-24 text-right text-xs"
                              value={effPrice(l) || ""}
                              aria-label={`Harga ${l.name}`}
                              onChange={(e) => {
                                const n = Number(e.target.value.replace(/\D/g, "")) || 0;
                                setCart((c) => c.map((x, xi) => (xi === i ? { ...x, priceOverride: n } : x)));
                              }}
                            />
                          </label>
                        )}

                        <label className="flex items-center gap-1 text-xs">
                          <span className="text-gray-500">Disk</span>
                          <Input
                            inputMode="numeric"
                            className="h-9 w-20 text-right text-xs"
                            value={l.discount || ""}
                            aria-label={`Diskon ${l.name}`}
                            onChange={(e) => {
                              const n = Number(e.target.value.replace(/\D/g, "")) || 0;
                              setCart((c) => c.map((x, xi) => (xi === i ? { ...x, discount: n } : x)));
                            }}
                          />
                        </label>

                        <span className="ml-auto text-sm font-extrabold text-gray-900">
                          {formatRupiah(calcLineTotal(l.qty, effPrice(l), l.discount))}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Totals & Payment Actions */}
              <div className="space-y-3 border-t border-warm-100 p-4 bg-warm-50/50">
                <Row k="Subtotal" v={formatRupiah(subtotal)} />
                {itemDiscTotal > 0 && <Row k="Diskon item" v={`-${formatRupiah(itemDiscTotal)}`} />}

                <div className="flex items-center gap-2">
                  <NativeSelect className="h-9 w-28 text-xs" value={trxType} onChange={(e) => setTrxType(e.target.value as typeof trxType)} aria-label="Jenis diskon transaksi">
                    <option value="">Diskon trx…</option>
                    <option value="fixed">Rp</option>
                    <option value="percentage">%</option>
                  </NativeSelect>
                  {trxType && (
                    <Input inputMode="numeric" className="h-9 w-24 text-right text-xs" value={trxValue || ""}
                      onChange={(e) => setTrxValue(Number(e.target.value.replace(/\D/g, "")) || 0)} aria-label="Nilai diskon transaksi" />
                  )}
                  <span className="ml-auto text-xs font-semibold text-red-600">{trxDisc > 0 ? `-${formatRupiah(trxDisc)}` : ""}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Input className="h-9 flex-1 uppercase text-xs" placeholder="Kode voucher" value={voucherInput} onChange={(e) => setVoucherInput(e.target.value.toUpperCase())} aria-label="Kode voucher" />
                  <Button size="sm" variant="outline" className="min-h-[36px]" onClick={() => void validateVoucher()}>Pakai</Button>
                  {voucher && (
                    <button className="text-xs text-red-600 underline font-medium" onClick={() => { setVoucher(null); setVoucherInput(""); }}>hapus</button>
                  )}
                </div>
                {voucher && <Row k={`Voucher ${voucher.code}`} v={`-${formatRupiah(voucherDisc)}`} strong />}

                <div className="flex justify-between border-t border-dashed border-warm-300 pt-2.5 text-lg font-extrabold">
                  <span>TOTAL AKHIR</span><span className="text-brand-700">{formatRupiah(total)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Metode Pembayaran</Label>
                    <NativeSelect className="h-11 font-semibold" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                      <option value="cash">Cash (Tunai)</option>
                      <option value="qris">QRIS</option>
                      <option value="debit">Debit Card</option>
                      <option value="kredit">Kredit (Piutang)</option>
                    </NativeSelect>
                  </div>
                  <div>
                    <Label>Nominal Dibayar</Label>
                    <Input inputMode="numeric" className="h-11 text-base font-bold" value={paid || ""} onChange={(e) => setPaid(Number(e.target.value.replace(/\D/g, "")) || 0)} placeholder="0" />
                  </div>
                </div>

                {method === "cash" && (
                  <div className="flex flex-wrap gap-1.5">
                    <QuickAmt label="Pas (F4)" onClick={() => setPaid(total)} />
                    <QuickAmt label="+10rb" onClick={() => setPaid((p) => p + 10_000)} />
                    <QuickAmt label="+50rb" onClick={() => setPaid((p) => p + 50_000)} />
                    <QuickAmt label="+100rb" onClick={() => setPaid((p) => p + 100_000)} />
                    <QuickAmt label="Reset" onClick={() => setPaid(0)} muted />
                  </div>
                )}

                <Row k="Kembalian Uang" v={formatRupiah(change)} strong />

                {(needsCredit || method === "kredit") && (
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-amber-50 p-3">
                    <div>
                      <Label>Nama Pelanggan *</Label>
                      <Input className="h-10" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Wajib diisi" />
                    </div>
                    <div>
                      <Label>Jatuh Tempo *</Label>
                      <Input type="date" className="h-10" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </div>
                    <p className="col-span-2 text-[11px] font-medium text-amber-800">Piutang sebesar {formatRupiah(unpaid)} akan dicatat.</p>
                  </div>
                )}

                <ErrorText message={err} />
                <Button size="lg" className="min-h-[52px] w-full text-base font-extrabold shadow-md shadow-brand-900/10" disabled={!cart.length || checkout.isPending} onClick={submitCheckout}>
                  {checkout.isPending ? "Memproses Transaksi…" : needsCredit ? "Simpan & Catat Piutang" : `Bayar ${formatRupiah(total)}`}
                </Button>
              </div>
            </>
          )}
        </Card>
      </section>

      {/* Modular Modals */}
      <HeldCartsModal
        open={heldModalOpen}
        onClose={() => setHeldModalOpen(false)}
        heldCarts={(heldCartsQ.data ?? []) as HeldCartRecord[]}
        isLoading={heldCartsQ.isLoading}
        onRestore={restoreHeldCart}
        onDelete={(id) => deleteHeldCartMut.mutate({ id })}
      />

      <Modal open={holdConfirmOpen} onClose={() => setHoldConfirmOpen(false)} title="Tahan Keranjang (Parkir)">
        <div className="space-y-3">
          <div>
            <Label>Label / Catatan Penanda</Label>
            <Input
              className="h-11"
              value={holdLabelInput}
              onChange={(e) => setHoldLabelInput(e.target.value)}
              placeholder="Contoh: Meja 3 / Bapak Jaket Hitam"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="min-h-[44px]" onClick={() => setHoldConfirmOpen(false)}>Batal</Button>
            <Button className="min-h-[44px]" onClick={confirmHoldCart}>Simpan & Kosongkan Keranjang</Button>
          </div>
        </div>
      </Modal>

      <OpenShiftModal
        open={openShiftModal}
        onClose={() => setOpenShiftModal(false)}
        startingCash={startingCashInput}
        onChangeStartingCash={setStartingCashInput}
        onSubmit={() => openShiftMut.mutate({ startingCash: Number(startingCashInput) || 0 })}
        isPending={openShiftMut.isPending}
      />

      <VariantPickerModal
        open={pickProduct !== null}
        onClose={() => setPickProduct(null)}
        productDetail={detailQ.data}
        isLoading={detailQ.isLoading}
        onSelectVariant={(item) => addToCart(item)}
      />

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
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-[38px] rounded-xl border px-3.5 text-xs font-semibold transition-all active:scale-95",
        muted ? "border-warm-200 text-gray-500 bg-white" : "border-brand-300 bg-brand-50 text-brand-800 hover:bg-brand-100"
      )}
    >
      {label}
    </button>
  );
}
