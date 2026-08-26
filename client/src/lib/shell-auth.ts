export type SessionUserLike = {
  id: number;
  username: string;
  name: string;
  role: string;
};

export async function fetchMe(): Promise<SessionUserLike | null> {
  try {
    const r = await fetch("/api/auth/me");
    if (!r.ok) return null;
    const d = await r.json();
    return d.user ?? null;
  } catch {
    return null;
  }
}

export async function doLogout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
}
