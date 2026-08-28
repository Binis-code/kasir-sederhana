import { PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import { formatRupiah } from "@shared/money.js";
import { Button, Modal, EmptyState, Spinner } from "../ui.js";

export type HeldCartRecord = {
  id: number;
  label: string;
  cartJson: string;
  subtotal: number;
  createdAt: Date | string;
};

export function HeldCartsModal({
  open,
  onClose,
  heldCarts,
  isLoading,
  onRestore,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  heldCarts: HeldCartRecord[];
  isLoading: boolean;
  onRestore: (held: HeldCartRecord) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Keranjang Tertahan (Parkir Pesanan)">
      <div className="space-y-3">
        {isLoading ? (
          <Spinner />
        ) : !heldCarts.length ? (
          <EmptyState
            icon={<PauseCircle size={28} />}
            title="Tidak ada keranjang tertahan"
            description="Tekan tombol 'Tahan (F6)' di keranjang untuk memarkir pesanan sementara."
          />
        ) : (
          <ul className="space-y-2">
            {heldCarts.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between rounded-xl border border-warm-200 bg-white p-3 shadow-xs"
              >
                <div>
                  <p className="font-semibold text-gray-900">{h.label}</p>
                  <p className="text-xs text-gray-500">
                    Total: <span className="font-bold text-brand-700">{formatRupiah(h.subtotal)}</span> ·{" "}
                    {new Date(h.createdAt).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="min-h-[40px] px-3"
                    onClick={() => onRestore(h)}
                  >
                    <PlayCircle size={15} /> Muat (F6)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[40px] px-3 text-red-600 hover:bg-red-50"
                    onClick={() => onDelete(h.id)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
