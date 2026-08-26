const RECENT_KEY = "kiosnusa:search:recent";
const FREQ_KEY = "kiosnusa:search:freq";
const RECENT_MAX = 10;
const FREQ_MAX = 50;

export type RecentQuery = { q: string; ts: number };

export function getRecentQueries(): RecentQuery[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function pushRecentQuery(q: string): void {
  if (typeof window === "undefined") return;
  const trimmed = q.trim();
  if (!trimmed) return;
  const arr = getRecentQueries().filter((x) => x.q !== trimmed);
  arr.unshift({ q: trimmed, ts: Date.now() });
  if (arr.length > RECENT_MAX) arr.length = RECENT_MAX;
  localStorage.setItem(RECENT_KEY, JSON.stringify(arr));
}

export function getFrequencyMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(FREQ_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function bumpSkuFrequency(skuKey: string): void {
  if (typeof window === "undefined") return;
  const map = getFrequencyMap();
  map[skuKey] = (map[skuKey] ?? 0) + 1;
  const entries = Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, FREQ_MAX);
  localStorage.setItem(FREQ_KEY, JSON.stringify(Object.fromEntries(entries)));
}

export function rankProducts<T extends { id: string; name: string; barcode?: string | null }>(
  products: T[],
  query: string,
  freqMap: Record<string, number>
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return products
    .filter((p) => {
      const hay = `${p.name} ${p.barcode ?? ""}`.toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => {
      const fa = freqMap[a.id] ?? 0;
      const fb = freqMap[b.id] ?? 0;
      return fb - fa;
    });
}