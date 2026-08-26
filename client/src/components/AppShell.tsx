import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "../lib/trpc.js";
import { doLogout, type SessionUserLike } from "../lib/shell-auth.js";
import { formatRupiah } from "@shared/money.js";
import { GlobalSearch } from "./GlobalSearch.js";
import { BarcodeScanner } from "./BarcodeScanner.js";
import { lookupBarcode } from "../lib/barcode-lookup.js";
import { Button, Badge, cn, toast } from "./ui.js";
import {
  LayoutDashboard, ShoppingCart, Package, Boxes, HandCoins,
  Menu, Search, Bell, ChevronLeft, ChevronRight, LogOut,
  Truck, ReceiptText, Wallet, BarChart3, Users2, Store, Tags, ScanLine
} from "lucide-react";

const NAV = [
  { group: "Workspace", items: [
    { href: "/", label: "Ringkasan", icon: LayoutDashboard },
    { href: "/pos", label: "Kasir", icon: ShoppingCart },
  ]},
  { group: "Operasional", items: [
    { href: "/products", label: "Produk", icon: Package },
    { href: "/suppliers", label: "Pemasok", icon: Truck },
    { href: "/purchases", label: "Pembelian", icon: ReceiptText },
    { href: "/inventory", label: "Stok", icon: Boxes },
    { href: "/opname", label: "Stok Opname", icon: Tags },
  ]},
  { group: "Keuangan", items: [
    { href: "/receivables", label: "Piutang", icon: HandCoins },
    { href: "/finance", label: "Kas Masuk/Keluar", icon: Wallet },
    { href: "/reports", label: "Laporan", icon: BarChart3 },
  ]},
];

function NavBadge({ counts, href }: { counts: { lowStock: number; overdue: number }; href: string }) {
  if (href === "/inventory" && counts.lowStock > 0) return <Badge tone="amber">{counts.lowStock}</Badge>;
  if (href === "/receivables" && counts.overdue > 0) return <Badge tone="red">{counts.overdue}</Badge>;
  return null;
}

export function AppShell({ user, children }: { user: SessionUserLike; children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("kiosnusa:sidebar") === "1");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const lowStockQ = trpc.dashboard.lowStockCount.useQuery(undefined, { refetchInterval: 60_000 });
  const overdueQ = trpc.dashboard.overdueReceivableCount.useQuery(undefined, { refetchInterval: 60_000 });
  const notifQ = trpc.notifications.feed.useQuery(undefined, { enabled: notifOpen });
  const counts = { lowStock: lowStockQ.data ?? 0, overdue: overdueQ.data ?? 0 };

  useEffect(() => { localStorage.setItem("kiosnusa:sidebar", collapsed ? "1" : "0"); }, [collapsed]);
  useEffect(() => { setMobileNavOpen(false); }, [location]);

  const isAdmin = user.role === "owner" || user.role === "admin";

  // Scan dari halaman mana pun → item masuk keranjang Kasir.
  async function handleGlobalScan(code: string) {
    const hit = await lookupBarcode(code);
    if (!hit) { toast(`Barcode ${code} tidak ditemukan`, "err"); return; }
    navigate(`/pos?add=${hit.variantId}`);
    toast(`${hit.name} siap di Kasir`);
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-warm-200 bg-white transition-all lg:flex",
        collapsed ? "w-16" : "w-64"
      )}>
        <div className="flex h-14 items-center gap-2 border-b border-warm-100 px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white"><Store size={16} /></div>
          {!collapsed && <span className="truncate text-sm font-bold text-gray-900">Kios Nusa</span>}
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {NAV.map(g => (
            <div key={g.group} className="mb-4">
              {!collapsed && <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{g.group}</p>}
              {g.items.map(it => (
                <Link key={it.href} href={it.href} title={it.label}
                  className={cn(
                    "mb-0.5 flex min-h-[44px] items-center gap-3 rounded-lg px-2.5 py-2 text-sm",
                    location === it.href ? "bg-brand-50 font-semibold text-brand-700" : "text-gray-700 hover:bg-warm-100"
                  )}>
                  <it.icon size={18} className="shrink-0" />
                  {!collapsed && <span className="flex-1 truncate">{it.label}</span>}
                  {!collapsed && <NavBadge counts={counts} href={it.href} />}
                </Link>
              ))}
            </div>
          ))}
          {isAdmin && (
            <div className="mb-4">
              {!collapsed && <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Sistem</p>}
              <Link href="/users" title="Pengguna"
                className={cn("mb-0.5 flex min-h-[44px] items-center gap-3 rounded-lg px-2.5 py-2 text-sm", location === "/users" ? "bg-brand-50 font-semibold text-brand-700" : "text-gray-700 hover:bg-warm-100")}>
                <Users2 size={18} />
                {!collapsed && <span>Pengguna</span>}
              </Link>
            </div>
          )}
        </nav>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="hidden min-h-[44px] items-center justify-center gap-2 border-t border-warm-100 py-2 text-xs text-gray-500 hover:bg-warm-50 lg:flex"
          aria-label={collapsed ? "Buka sidebar" : "Ciutkan sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /> Ciutkan</>}
        </button>
      </aside>

      {/* Main column */}
      <div className={cn("flex min-h-screen w-full flex-col", collapsed ? "lg:pl-16" : "lg:pl-64")}>
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-warm-200 bg-warm-25/95 px-3 backdrop-blur sm:px-4">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Buka menu" onClick={() => setMobileNavOpen(true)}>
            <Menu size={20} />
          </Button>
          <h1 className="flex-1 truncate text-base font-bold text-gray-900 sm:text-lg">Kios Nusa</h1>

          {/* Desktop inline search */}
          <Button variant="outline" size="icon" className="hidden md:flex" aria-label="Scan barang ke kasir" onClick={() => setScanOpen(true)}>
            <ScanLine size={18} />
          </Button>
          <button onClick={() => setSearchOpen(true)}
            className="hidden h-10 w-72 items-center gap-2 rounded-lg border border-warm-300 bg-white px-3 text-sm text-gray-400 hover:border-brand-400 md:flex">
            <Search size={16} /> Cari produk / barcode…
            <kbd className="ml-auto rounded border border-warm-200 bg-warm-50 px-1 text-[10px]">/</kbd>
          </button>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Cari" onClick={() => setSearchOpen(true)}><Search size={20} /></Button>

          <Button size="sm" className="min-h-[40px]" onClick={() => navigate("/pos")}>Kasir baru</Button>

          {/* Notifications */}
          <div className="relative">
            <Button variant="ghost" size="icon" aria-label="Notifikasi" onClick={() => { setNotifOpen(o => !o); setUserMenuOpen(false); }}>
              <Bell size={20} />
              {(counts.lowStock + counts.overdue) > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {counts.lowStock + counts.overdue}
                </span>
              )}
            </Button>
            {notifOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-warm-200 bg-white shadow-xl">
                  <p className="border-b border-warm-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Perlu perhatian</p>
                  <div className="max-h-96 overflow-y-auto p-2">
                    {notifQ.isLoading ? (
                      <p className="px-2 py-3 text-xs text-gray-400">Memuat…</p>
                    ) : (notifQ.data?.lowStock.length ?? 0) + (notifQ.data?.dueReceivables.length ?? 0) === 0 ? (
                      <p className="px-2 py-3 text-xs text-gray-400">Tidak ada peringatan. Semua aman.</p>
                    ) : (
                      <>
                        {notifQ.data?.lowStock.map(p => (
                          <a key={`s${p.id}`} href="/inventory" className="block rounded-lg px-2 py-2 hover:bg-warm-100" onClick={() => setNotifOpen(false)}>
                            <p className="text-sm font-medium text-gray-800">Stok menipis — {p.name}</p>
                            <p className="text-[11px] text-amber-700">sisa {p.stock}, minimum {p.minStock}</p>
                          </a>
                        ))}
                        {notifQ.data?.dueReceivables.map(r => (
                          <a key={`r${r.id}`} href="/receivables" className="block rounded-lg px-2 py-2 hover:bg-warm-100" onClick={() => setNotifOpen(false)}>
                            <p className="text-sm font-medium text-gray-800">Piutang jatuh tempo — {r.customerName}</p>
                            <p className="text-[11px] text-red-600">{formatRupiah(r.amount)} · tempo {r.dueDate}</p>
                          </a>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* User menu */}
          <div className="relative">
            <button onClick={() => { setUserMenuOpen(o => !o); setNotifOpen(false); }}
              className="flex h-9 max-w-36 items-center gap-2 rounded-full border border-warm-200 bg-white pl-1 pr-2 text-left hover:bg-warm-100">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span className="hidden truncate text-xs font-medium sm:block">{user.name}</span>
            </button>
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-warm-200 bg-white py-1 shadow-xl">
                  <p className="px-3 py-1.5 text-[11px] text-gray-400">{user.username} · {user.role}</p>
                  <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50" onClick={() => void doLogout()}>
                    <LogOut size={15} /> Keluar
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 pb-[calc(72px+env(safe-area-inset-bottom))] lg:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNavOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 overflow-y-auto bg-white p-3">
            <p className="mb-3 px-2 text-sm font-bold text-gray-900">Kios Nusa</p>
            {NAV.map(g => (
              <div key={g.group} className="mb-3">
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{g.group}</p>
                {g.items.map(it => (
                  <Link key={it.href} href={it.href}
                    className={cn("mb-0.5 flex min-h-[44px] items-center gap-3 rounded-lg px-2.5 py-2 text-sm",
                      location === it.href ? "bg-brand-50 font-semibold text-brand-700" : "text-gray-700 hover:bg-warm-100")}>
                    <it.icon size={18} /><span className="flex-1">{it.label}</span>
                    <NavBadge counts={counts} href={it.href} />
                  </Link>
                ))}
              </div>
            ))}
            {isAdmin && (
              <Link href="/users" className={cn("flex min-h-[44px] items-center gap-3 rounded-lg px-2.5 py-2 text-sm", location === "/users" ? "bg-brand-50 font-semibold text-brand-700" : "text-gray-700 hover:bg-warm-100")}>
                <Users2 size={18} /> Pengguna
              </Link>
            )}
          </aside>
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-warm-200 bg-white lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }} aria-label="Navigasi bawah">
        {[
          { href: "/", label: "Ringkasan", icon: LayoutDashboard },
          { href: "/pos", label: "Kasir", icon: ShoppingCart },
          { href: "/products", label: "Produk", icon: Package },
          { href: "/inventory", label: "Stok", icon: Boxes },
          { href: "/receivables", label: "Piutang", icon: HandCoins },
        ].map(it => (
          <Link key={it.href} href={it.href}
            className={cn("relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px]",
              location === it.href ? "font-semibold text-brand-700" : "text-gray-500")}>
            <it.icon size={20} />
            {it.label}
            <NavBadge counts={counts} href={it.href} />
          </Link>
        ))}
      </nav>

      {/* Mobile scan FAB — semua halaman kecuali Kasir (sudah ada tombol scan sendiri) */}
      {location !== "/pos" && (
        <button
          onClick={() => setScanOpen(true)}
          aria-label="Scan barang ke kasir"
          className={cn(
            "fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-900/20 hover:bg-brand-700 active:scale-95 lg:hidden",
            "bottom-[calc(76px+env(safe-area-inset-bottom))]"
          )}
        >
          <ScanLine size={24} />
        </button>
      )}

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {scanOpen && (
        <BarcodeScanner
          onDetect={(code) => { setScanOpen(false); void handleGlobalScan(code); }}
          onClose={() => setScanOpen(false)}
        />
      )}

      {/* keyboard shortcut */}
      <KeySlash onOpen={() => setSearchOpen(true)} />
    </div>
  );
}

function KeySlash({ onOpen }: { onOpen: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "/") { e.preventDefault(); onOpen(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpen]);
  return null;
}

