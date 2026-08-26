import { useState } from "react";
import { trpc } from "../lib/trpc.js";
import { formatRupiah } from "@shared/money.js";
import { Button, Card, Input, Label, NativeSelect, Badge, Spinner, Modal, EmptyState, toast, formatDate } from "../components/ui.js";
import { HandCoins } from "lucide-react";

const TABS = [
  { key: "", label: "Semua" },
  { key: "open", label: "Belum dibayar" },
  { key: "partial", label: "Sebagian" },
  { key: "paid", label: "Lunas" },
  { key: "overdue", label: "Jatuh tempo" },
] as const;

export default function Receivables() {
  const [tab, setTab] = useState<string>("");
  const q = trpc.receivables.list.useQuery(
    tab === "overdue" ? { overdueOnly: true } : tab ? { status: tab as "open" | "partial" | "paid" } : {}
  );

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-sm font-bold text-gray-800">Piutang</h2>
      <div className="flex flex-wrap gap-1.5">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={"min-h-[36px] rounded-full border px-3 text-xs font-medium " +
              (tab === t.key ? "border-brand-600 bg-brand-600 text-white" : "border-warm-300 bg-white text-gray-600")}>
            {t.label}
          </button>
        ))}
      </div>

      {q.isLoading ? <Spinner /> : !q.data?.length ? (
        <Card><EmptyState icon={<HandCoins size={28} />} title="Tidak ada piutang pada filter ini" /></Card>
      ) : (
        <div className="space-y-2">
          {q.data.map(r => {
            const remaining = r.amount - r.paidAmount;
            const overdue = r.status !== "paid" && new Date(r.dueDate) < new Date(new Date().toDateString());
            return (
              <Card key={r.id} className="flex flex-wrap items-center gap-3 p-3.5">
                <div className="min-w-[200px] flex-1">
                  <p className="text-sm font-semibold">{r.customerName} <span className="text-xs text-gray-400">{r.invoiceNo}</span></p>
                  <p className="text-[11px] text-gray-500">tempo {formatDate(r.dueDate)}</p>
                </div>
                <Badge tone={r.status === "paid" ? "green" : overdue ? "red" : r.status === "partial" ? "amber" : "blue"}>
                  {r.status === "paid" ? "Lunas" : overdue ? "Jatuh tempo" : r.status}
                </Badge>
                <div className="text-right">
                  <p className="text-sm font-bold">{formatRupiah(remaining)}</p>
                  {r.paidAmount > 0 && r.status !== "paid" && <p className="text-[11px] text-gray-400">dibayar {formatRupiah(r.paidAmount)}</p>}
                </div>
                {r.status !== "paid" && <PayButton id={r.id} max={remaining} />}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PayButton({ id, max }: { id: number; max: number }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const pay = trpc.receivables.pay.useMutation({
    onSuccess: (r) => { toast(r.status === "paid" ? "Piutang lunas 🎉".replace(" 🎉", "") : "Pembayaran dicatat"); setOpen(false); void utils.receivables.list.invalidate(); },
    onError: (e) => toast(e.message, "err"),
  });
  const [amount, setAmount] = useState(max);
  const [note, setNote] = useState("");

  return (
    <>
      <Button size="sm" onClick={() => { setAmount(max); setOpen(true); }}>Terima bayar</Button>
      {open && (
        <Modal open onClose={() => setOpen(false)} title="Catat pembayaran piutang">
          <div className="space-y-3">
            <div><Label>Nominal *</Label><Input inputMode="numeric" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, "")) || 0)} /></div>
            <p className="text-[11px] text-gray-500">Sisa piutang: {formatRupiah(max)}</p>
            <div><Label>Catatan</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="opsional" /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button disabled={amount < 1 || amount > max || pay.isPending} onClick={() => pay.mutate({ id, amount, note: note || null })}>
                {pay.isPending ? "Menyimpan…" : "Simpan"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
