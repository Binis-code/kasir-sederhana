import { useState } from "react";
import { trpc } from "../lib/trpc.js";
import { formatRupiah } from "@shared/money.js";
import {
  Button, Card, CardHeader, Input, Label, Badge, Spinner, Modal,
  formatDateTime, cn, toast, EmptyState
} from "../components/ui.js";
import { Wallet, CheckCircle2, History, Database, Download, ShieldCheck, AlertCircle } from "lucide-react";

export default function ShiftPage({ role }: { role?: string }) {
  const isAdmin = role === "owner" || role === "admin";
  const utils = trpc.useUtils();

  const currentShiftQ = trpc.shifts.current.useQuery();
  const shiftListQ = trpc.shifts.list.useQuery({ limit: 30 }, { enabled: isAdmin });
  const backupsQ = trpc.backup.listSnapshots.useQuery(undefined, { enabled: isAdmin });

  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [startingCash, setStartingCash] = useState("");
  const [actualCash, setActualCash] = useState("");
  const [notes, setNotes] = useState("");

  const openMut = trpc.shifts.open.useMutation({
    onSuccess: () => {
      toast("Shift berhasil dibuka");
      setOpenModal(false);
      setStartingCash("");
      void currentShiftQ.refetch();
      if (isAdmin) void shiftListQ.refetch();
    },
    onError: (e) => toast(e.message, "err"),
  });

  const closeMut = trpc.shifts.close.useMutation({
    onSuccess: (res) => {
      toast(`Shift ditutup. Selisih kas: ${formatRupiah(res.cashDiff)}`);
      setCloseModal(false);
      setActualCash("");
      setNotes("");
      void currentShiftQ.refetch();
      if (isAdmin) void shiftListQ.refetch();
    },
    onError: (e) => toast(e.message, "err"),
  });

  const backupMut = trpc.backup.createSnapshot.useMutation({
    onSuccess: (res) => {
      toast(`Backup berhasil dibuat: ${res.filename}`);
      void backupsQ.refetch();
    },
    onError: (e) => toast(e.message, "err"),
  });

  const shift = currentShiftQ.data;

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900">Manajemen Shift & Keamanan Kas</h2>
          <p className="text-xs text-gray-500">Rekonsiliasi uang laci kas kasir (cash drawer) & backup database</p>
        </div>
      </div>

      {/* Current shift status */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn("rounded-xl p-3", shift ? "bg-brand-50 text-brand-700" : "bg-amber-50 text-amber-700")}>
              <Wallet size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-gray-900">
                  {shift ? "Shift Kasir Sedang Berjalan (Aktif)" : "Tidak Ada Shift Aktif"}
                </p>
                <Badge tone={shift ? "green" : "neutral"}>{shift ? "Aktif" : "Ditutup"}</Badge>
              </div>
              <p className="text-xs text-gray-500">
                {shift
                  ? `Dibuka sejak ${formatDateTime(shift.openedAt)} · Modal awal: ${formatRupiah(shift.startingCash)}`
                  : "Buka shift baru sebelum memulai transaksi kasir untuk pelacakan kas laci yang akurat."}
              </p>
            </div>
          </div>

          <div>
            {shift ? (
              <Button onClick={() => setCloseModal(true)}>
                <CheckCircle2 size={16} /> Tutup Shift & Rekonsiliasi Kas
              </Button>
            ) : (
              <Button onClick={() => setOpenModal(true)}>
                <Wallet size={16} /> Buka Shift Kasir
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Admin section: Database Snapshots & Backup */}
      {isAdmin && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Shift History */}
          <Card>
            <CardHeader title="Riwayat Shift Terakhir" />
            <div className="max-h-80 overflow-y-auto divide-y divide-warm-100">
              {shiftListQ.isLoading ? <Spinner /> :
               !shiftListQ.data?.length ? (
                <EmptyState icon={<History size={24} />} title="Belum ada riwayat shift" />
              ) : (
                shiftListQ.data.map(s => (
                  <div key={s.id} className="p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-800">{s.cashierName}</span>
                      <Badge tone={s.status === "open" ? "green" : (s.cashDiff ?? 0) === 0 ? "neutral" : (s.cashDiff ?? 0) < 0 ? "red" : "amber"}>
                        {s.status === "open" ? "Aktif" : `Selisih ${formatRupiah(s.cashDiff ?? 0)}`}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-gray-500">
                      <span>Buka: {formatDateTime(s.openedAt)}</span>
                      {s.closedAt && <span>· Tutup: {formatDateTime(s.closedAt)}</span>}
                    </div>
                    {s.status === "closed" && (
                      <div className="mt-1 grid grid-cols-3 gap-1 rounded bg-warm-50 p-1.5 text-[11px]">
                        <div>Modal: <b>{formatRupiah(s.startingCash)}</b></div>
                        <div>Ekspektasi: <b>{formatRupiah(s.expectedCash ?? 0)}</b></div>
                        <div>Fisik Kas: <b>{formatRupiah(s.actualCash ?? 0)}</b></div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Database Backup Section */}
          <Card>
            <div className="flex items-center justify-between border-b border-warm-100 px-4 py-3">
              <div>
                <h3 className="text-sm font-bold text-gray-800">Backup & Snapshot Database</h3>
                <p className="text-xs text-gray-500">Pencadangan file database SQLite lokal</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={backupMut.isPending}
                onClick={() => backupMut.mutate()}
              >
                <Database size={14} /> Buat Backup Sekarang
              </Button>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-warm-100 p-2">
              {backupsQ.isLoading ? <Spinner /> :
               !backupsQ.data?.length ? (
                <EmptyState icon={<ShieldCheck size={24} />} title="Belum ada snapshot backup" description="Klik 'Buat Backup Sekarang' untuk mencadangkan database." />
              ) : (
                backupsQ.data.map(b => (
                  <div key={b.filename} className="flex items-center justify-between p-2 text-xs">
                    <div>
                      <p className="font-semibold text-gray-800">{b.filename}</p>
                      <p className="text-[11px] text-gray-500">
                        {Math.round(b.sizeBytes / 1024)} KB · {new Date(b.createdAt).toLocaleString("id-ID")}
                      </p>
                    </div>
                    <Badge tone="green">Tersimpan</Badge>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Open Modal */}
      <Modal open={openModal} onClose={() => setOpenModal(false)} title="Buka Shift Kasir">
        <div className="space-y-3">
          <div>
            <Label>Modal Awal di Laci Kas (Cash Drawer)</Label>
            <Input
              inputMode="numeric"
              value={startingCash}
              onChange={(e) => setStartingCash(e.target.value.replace(/\D/g, ""))}
              placeholder="Contoh: 200000"
            />
          </div>
          <div>
            <Label>Catatan (Opsional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Shift pagi / kasir 1"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpenModal(false)}>Batal</Button>
            <Button disabled={openMut.isPending} onClick={() => openMut.mutate({ startingCash: Number(startingCash) || 0, notes: notes || null })}>
              Buka Shift
            </Button>
          </div>
        </div>
      </Modal>

      {/* Close Modal */}
      <Modal open={closeModal} onClose={() => setCloseModal(false)} title="Tutup Shift & Rekonsiliasi Kas Laci">
        <div className="space-y-3">
          <p className="text-xs text-gray-600">
            Hitung seluruh uang fisik (kertas & koin) yang ada di laci kas saat ini. Sistem akan otomatis menghitung selisih terhadap modal awal dan penjualan cash.
          </p>
          <div>
            <Label>Uang Fisik Kas di Laci *</Label>
            <Input
              inputMode="numeric"
              value={actualCash}
              onChange={(e) => setActualCash(e.target.value.replace(/\D/g, ""))}
              placeholder="Contoh: 1250000"
            />
          </div>
          <div>
            <Label>Catatan Penutupan Shift</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Semua uang diserahkan ke brankas/owner"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCloseModal(false)}>Batal</Button>
            <Button disabled={closeMut.isPending} onClick={() => closeMut.mutate({ actualCash: Number(actualCash) || 0, notes: notes || null })}>
              Konfirmasi Tutup Shift
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
