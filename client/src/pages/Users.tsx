import { useState } from "react";
import { trpc } from "../lib/trpc.js";
import { Button, Card, Input, Label, NativeSelect, Badge, Spinner, Modal, EmptyState, toast, formatDateTime } from "../components/ui.js";
import { Plus, Users2 } from "lucide-react";

const ROLES = ["kasir", "admin", "owner"] as const;

export default function Users() {
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState<number | null>(null);
  const list = trpc.users.list.useQuery({});

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800">Pengguna & Peran</h2>
        <Button onClick={() => setEditing(0)}><Plus size={16} /> Pengguna baru</Button>
      </div>

      {list.isLoading ? <Spinner /> : !list.data?.items.length ? (
        <Card><EmptyState icon={<Users2 size={28} />} title="Belum ada pengguna" /></Card>
      ) : (
        <Card>
          <ul className="divide-y divide-warm-100">
            {list.data.items.map(u => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                  {u.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-[160px] flex-1">
                  <p className="text-sm font-semibold">{u.name} <span className="text-xs font-normal text-gray-400">@{u.username}</span></p>
                  <p className="text-[11px] text-gray-500">
                    login terakhir: {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "belum pernah"}
                  </p>
                </div>
                <Badge tone={u.role === "owner" ? "green" : u.role === "admin" ? "blue" : "neutral"}>{u.role}</Badge>
                <Button variant="outline" size="sm" onClick={() => setEditing(u.id)}>Edit</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {editing !== null && (
        <UserModal id={editing === 0 ? null : editing} onClose={(changed) => {
          setEditing(null);
          if (changed) void utils.users.list.invalidate();
        }} />
      )}
    </div>
  );
}

function UserModal({ id, onClose }: { id: number | null; onClose: (changed: boolean) => void }) {
  const detail = trpc.users.get.useQuery({ id: id! }, { enabled: id !== null });
  const create = trpc.users.create.useMutation({
    onSuccess: () => { toast("Pengguna dibuat"); onClose(true); },
    onError: (e) => toast(e.message, "err"),
  });
  const update = trpc.users.update.useMutation({
    onSuccess: () => { toast("Pengguna diperbarui"); onClose(true); },
    onError: (e) => toast(e.message, "err"),
  });

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("kasir");
  const [loaded, setLoaded] = useState(false);

  if (id !== null && detail.data && !loaded) {
    setUsername(detail.data.username);
    setName(detail.data.name);
    setEmail(detail.data.email ?? "");
    setRole((detail.data.role as typeof role) ?? "kasir");
    setLoaded(true);
  }

  function submit() {
    if (!username.trim() || !name.trim()) { toast("Username & nama wajib", "err"); return; }
    if (id === null && password.length < 6) { toast("Password minimal 6 karakter", "err"); return; }
    if (id === null) {
      create.mutate({ username: username.trim(), name: name.trim(), email: email.trim() || null, password, role });
    } else {
      update.mutate({ id, username: username.trim(), name: name.trim(), email: email.trim() || null, role, ...(password ? { password } : {}) } as never);
    }
  }

  return (
    <Modal open onClose={() => onClose(false)} title={id === null ? "Pengguna baru" : `Edit @${username}`}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Username *</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} disabled={id !== null} /></div>
          <div><Label>Nama *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        </div>
        <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><Label>{id === null ? "Password *" : "Password baru (kosongkan bila tetap)"}</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></div>
        <div><Label>Peran *</Label>
          <NativeSelect value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </NativeSelect>
          <p className="mt-1 text-[10px] text-gray-400">Kasir: kasir saja · Admin/Owner: semua modul.</p></div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onClose(false)}>Batal</Button>
          <Button onClick={submit} disabled={create.isPending || update.isPending}>Simpan</Button>
        </div>
      </div>
    </Modal>
  );
}
