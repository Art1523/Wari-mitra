/**
 * Tiny localStorage-backed store with a pub/sub layer.
 *
 * This is the ONLY place the prototype touches persistence. Every service in
 * `src/services/*` goes through here, so a future FastAPI backend can replace
 * these functions with `fetch()` calls without touching any component.
 */

const PREFIX = "warimitra:";

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

export function readKey<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeKey<T>(key: string, value: T): T {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* quota / private mode — prototype keeps working in memory */
    }
  }
  emit(key);
  return value;
}

export function clearKey(key: string) {
  if (typeof window !== "undefined") window.localStorage.removeItem(PREFIX + key);
  emit(key);
}

export function subscribe(key: string, fn: Listener) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(fn);
  return () => {
    listeners.get(key)?.delete(fn);
  };
}

function emit(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
  listeners.get("*")?.forEach((fn) => fn());
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.floor(h / 24)} d ago`;
}
