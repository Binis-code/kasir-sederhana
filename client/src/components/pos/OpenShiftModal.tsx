import { Wallet } from "lucide-react";
import { Button, Input, Label, Modal } from "../ui.js";

export function OpenShiftModal({
  open,
  onClose,
  startingCash,
  onChangeStartingCash,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  startingCash: string;
  onChangeStartingCash: (val: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Buka Shift Kasir Baru">
      <div className="space-y-4">
        <div>
          <Label>Modal Awal di Laci Kas (Cash Drawer) *</Label>
          <Input
            inputMode="numeric"
            className="h-11 text-base font-semibold"
            value={startingCash}
            onChange={(e) => onChangeStartingCash(e.target.value.replace(/\D/g, ""))}
            placeholder="Contoh: 200000"
            autoFocus
          />
          <p className="mt-1 text-[11px] text-gray-500">
            Masukkan nominal uang kecil / modal kasir sebelum melayani transaksi.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" className="min-h-[44px]" onClick={onClose}>
            Nanti Saja
          </Button>
          <Button className="min-h-[44px]" disabled={isPending} onClick={onSubmit}>
            <Wallet size={16} /> Buka Shift Sekarang
          </Button>
        </div>
      </div>
    </Modal>
  );
}
