import { useState } from "react";
import { trpc } from "../lib/trpc.js";
import { Button, Card, Input, Label, Badge, Spinner, Modal, EmptyState, toast, formatDate } from "../components/ui.js";
import { Plus, Pencil, Truck } from "lucide-react";

export default function Suppliers() {
  const [editing, setEditing] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const list = trpc.suppliers.list.useQuery({});

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800">Pemasok</h2>
        <Button onClick={() => setEditing(0)}><Plus size={16} /> Pemasok baru</Button>
      </div>

      {list.isLoading ? <Spinner /> : !list.data?.items.length ? (
        <Card><EmptyState icon={<Truck size={28} />} title="Belum ada pemasok" /></Card>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {list.data.items.map(s => (
            <Card key={s.id} className="p-3.5">
              <div className="flex items-start justify-between">
                <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                {!s.isActive && <Badge>nonaktif</Badge>}
              </div>
              {s.phone && <p className="text-xs text-gray-600">☎ {s.phone}</p>}
              {s.address && <p className="mt-0.5 text-[11px] text-gray-500">{s.address}</p>}
              <Button variant="outline" size="sm" className="mt-2" onClick={() => setEditing(s.id)}>
                <Pencil size={13} /> Edit
              </Button>
            </Card>
          ))}
        </div>
      )}

      {editing !== null && (
        <SupplierModal id={editing === 0 ? null : editing} onClose={(c) => {
          setEditing(null);
          if (c) void utils.suppliers.list.invalidate();
        }} />
      )}
    </div>
  );
}

function SupplierModal({ id, onClose }: { id: number | null; onClose: (changed: boolean) => void }) {
  const detail = trpc.suppliers.get.useQuery({ id: id! }, { enabled: id !== null });
  const create = trpc.suppliers.create.useMutation({
    onSuccess: () => { toast("Pemasok dibuat"); onClose(true); },
    onError: (e) => toast(e.message, "err"),
  });
  const update = trpc.suppliers.update.useMutation({
    onSuccess: () => { toast("Pemasok diperbarui"); onClose(true); },
    onError: (e) => toast(e.message, "err"),
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [loaded, setLoaded] = useState(false);

  if (id !== null && detail.data && !loaded) {
    setName(detail.data.name);
    setPhone(detail.data.phone ?? "");
    setAddress(detail.data.address ?? "");
    setNotes(detail.data.notes ?? "");
    setLoaded(true);
  }

  function submit() {
    if (!name.trim()) { toast("Nama wajib", "err"); return; }
    const payload = { name: name.trim(), phone: phone.trim() || null, address: address.trim() || null, notes: notes.trim() || null, isActive: true };
    if (id === null) create.mutate(payload as never);
    else update.mutate({ id, ...payload } as never);
  }

  return (
    <Modal open onClose={() => onClose(false)} title={id === null ? "Pemasok baru" : "Edit pemasok"}>
      <div className="space-y-3">
        <div><Label>Nama *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label>Telepon</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /></div>
        <div><Label>Alamat</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
        <div><Label>Catatan</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onClose(false)}>Batal</Button>
          <Button onClick={submit} disabled={create.isPending || update.isPending}>Simpan</Button>
        </div>
      </div>
    </Modal>
  );
}
