import { useState } from "react";
import { Button, Card, Input, Label, ErrorText } from "../components/ui.js";
import { Store } from "lucide-react";
import type { SessionUserLike } from "../lib/shell-auth.js";

export default function Login({ onLoggedIn }: { onLoggedIn: (user: SessionUserLike) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error ?? "Login gagal");
        return;
      }
      onLoggedIn(d.user);
    } catch {
      setError("Tidak dapat menghubungi server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-warm-100 px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white"><Store size={22} /></div>
          <h1 className="text-lg font-bold text-gray-900">Kios Nusa</h1>
          <p className="text-xs text-gray-500">Masuk untuk membuka kasir & kelola toko</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required autoFocus />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          <ErrorText message={error} />
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Memproses…" : "Masuk"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
