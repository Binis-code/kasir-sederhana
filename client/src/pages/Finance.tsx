import { useMemo, useState } from "react";
import { trpc } from "../lib/trpc.js";
import { formatRupiah } from "@shared/money.js";
import { Button, Card, Input, Label, NativeSelect, Badge, Spinner, Modal, EmptyState, toast, formatDate, cn } from "../components/ui.js";
import { Plus, Wallet, Trash2 } from "lucide-react";
import type { SessionUserLike } from "../lib/shell-auth.js";

export default function Finance({ user }: { user: SessionUserLike }) {
  const isAdmin = user.role === "owner" || user.role === "admin";
  const utils = trpc.useUtils();
  const [typeFilter, setTypeFilter] = useState<"" | "income" | "expense">("");
  const list = trpc.finance.listEntries.useQuery({ type: typeFilter || undefined, limit: 100 });
  const create = trpc.finance.createEntry.useMutation({
    onSuccess: () => { toast("Entri disimpan"); setOpen(false); void utils.finance.listEntries.invalidate(); },
    onError: (e) => toast(e.message, "err"),
  });
  const del = trpc.finance.deleteEntry.useMutation({
    onSuccess: () => { toast("Entri dihapus"); void utils.finance.listEntries.invalidate(); },
    onError: (e) => toast(e.message, "err"),
  });

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const today = new Date().toISOString().slice(0, 10);
  const [entryDate, setEntryDate] = useState(today);

  const totals = useMemo(() => {
    const items = list.data ?? [];
    return items.reduce((acc, e) => {
      if (e.type === "income") acc.in += e.amount; else acc.out += e.amount;
      return acc;
    }, { in: 0, out: 0 });
  }, [list.data]);

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-gray-800">Kas Masuk & Keluar</h2>
        <NativeSelect className="ml-auto max-w-[140px]" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}>
          <option value="">Semua</option>
          <option value="income">Masuk</option>
          <option value="expense">Keluar</option>
        </NativeSelect>
        {isAdmin && <Button onClick={() => setOpen(true)}><Plus size={16} /> Entri baru</Button>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3.5"><p className="text-[11px] uppercase text-gray-500">Total masuk</p>
          <p className="text-lg font-bold text-brand-700">{formatRupiah(totals.in)}</p></Card>
        <Card className="p-3.5"><p className="text-[11px] uppercase text-gray-500">Total keluar</p>
          <p className="text-lg font-bold text-red-600">{formatRupiah(totals.out)}</p></Card>
      </div>

      {list.isLoading ? <Spinner /> : !list.data?.length ? (
        <Card><EmptyState icon={<Wallet size={28} />} title="Belum ada entri kas" description={isAdmin ? "Catat pengeluaran operasional atau pemasukan lain." : undefined} /></Card>
      ) : (
        <Card>
          <ul className="divide-y divide-warm-100">
            {list.data.map(e => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Badge tone={e.type === "income" ? "green" : "red"}>{e.type === "income" ? "Masuk" : "Keluar"}</Badge>
                <div className="min-w-[160px] flex-1">
                  <p className="text-sm font-medium">{e.description}</p>
                  <p className="text-[11px] text-gray-500">{e.category} · {formatDate(e.entryDate)} · {e.userName}</p>
                </div>
                <span className={cn("text-sm font-bold", e.type === "income" ? "text-brand-700" : "text-red-600")}>
                  {e.type === "income" ? "+" : "-"}{formatRupiah(e.amount)}
                </span>
                {isAdmin && (
                  <button aria-label="Hapus entri" className="rounded p-1.5 text-gray-300 hover:text-red-600"
                    onClick={() => { if (confirm("Hapus entri ini?")) del.mutate({ id: e.id }); }}>
                    <Trash2 size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {open && (
        <Modal open onClose={() => setOpen(false)} title="Entri kas baru">
          <div className="space-y-3">
            <div><Label>Jenis *</Label>
              <NativeSelect value={type} onChange={(ev) => setType(ev.target.value as typeof type)}>
                <option value="expense">Pengeluaran</option>
                <option value="income">Pemasukan lain</option>
              </NativeSelect></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Kategori *</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="listrik/transport…" /></div>
              <div><Label>Tanggal *</Label><Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} /></div>
            </div>
            <div><Label>Deskripsi *</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div><Label>Nominal *</Label><Input inputMode="numeric" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, "")) || 0)} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button disabled={!category.trim() || !description.trim() || amount < 1 || create.isPending}
                onClick={() => create.mutate({ type, category: category.trim(), description: description.trim(), amount, entryDate })}>
                Simpan
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
