/**
 * Short-lived store of confirmed hospital transfers, keyed by the Exotel call id.
 *
 * A number is written ONLY after the caller explicitly confirmed the transfer,
 * lives for 5 minutes at most, and is deleted the moment the Exotel Connect
 * applet reads it. Nothing here is ever logged.
 */

interface PendingTransfer {
  /** Verified hospital number in E.164, from the Places directory result. */
  number: string;
  expiresAt: number;
}

const TTL_MS = 5 * 60 * 1000;
/** Window in which an unkeyed Connect request may claim the newest transfer. */
const LATEST_WINDOW_MS = 180 * 1000;

const g = globalThis as unknown as {
  __wmTransfers?: Map<string, PendingTransfer>;
  __wmAliases?: Map<string, Set<string>>;
  __wmLatest?: PendingTransfer | undefined;
};
const STORE = (g.__wmTransfers ??= new Map<string, PendingTransfer>());
const ALIASES = (g.__wmAliases ??= new Map<string, Set<string>>());

function sweep() {
  const now = Date.now();
  for (const [id, t] of STORE) if (t.expiresAt <= now) STORE.delete(id);
  if (g.__wmLatest && g.__wmLatest.expiresAt <= now) g.__wmLatest = undefined;
}

/** Normalise a Places phone string to E.164, defaulting to India (+91). */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (trimmed.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return null;
}

/**
 * Exotel's Connect applet dials Indian numbers in national format
 * (0 + 10 digits). A leading "+91" is frequently rejected, which is why the
 * transfer endpoint hands back the national form by default.
 */
export function toExotelDialable(e164: string): string {
  const digits = e164.replace(/[^\d]/g, "");
  if (digits.startsWith("91") && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.length === 10) return `0${digits}`;
  return e164;
}

/**
 * Register extra Exotel identifiers (stream sid, call sid) that may be used by
 * the Connect applet to look the transfer up later.
 */
export function linkTransferAliases(sessionId: string, aliases: (string | undefined | null)[]) {
  const set = ALIASES.get(sessionId) ?? new Set<string>();
  for (const a of aliases) if (a) set.add(a);
  set.add(sessionId);
  ALIASES.set(sessionId, set);
}

/**
 * Demo receptionist number (prototype only). When DEMO_TRANSFER_NUMBER is set,
 * every consented hospital connect is routed to this one verified test number
 * instead of the hospital's published line.
 */
export function demoTransferNumber(): string | null {
  return toE164(process.env["DEMO_TRANSFER_NUMBER"] ?? null);
}

export function setConfirmedTransfer(callId: string, number: string) {
  if (!callId || !number) return;
  sweep();
  const entry: PendingTransfer = { number, expiresAt: Date.now() + TTL_MS };
  STORE.set(callId, entry);
  for (const alias of ALIASES.get(callId) ?? []) STORE.set(alias, entry);
  g.__wmLatest = entry;
}

/** Read-and-delete. Returns null when there is no confirmed, unexpired transfer. */
export function consumeTransfer(callId: string): string | null {
  sweep();
  const entry = callId ? STORE.get(callId) : undefined;
  if (entry) {
    for (const [k, v] of STORE) if (v === entry) STORE.delete(k);
    if (g.__wmLatest === entry) g.__wmLatest = undefined;
    return entry.expiresAt > Date.now() ? entry.number : null;
  }
  // Exotel does not always forward the same identifier the media stream used.
  // Fall back to the newest confirmation from the last ~90 seconds.
  const latest = g.__wmLatest;
  if (latest && latest.expiresAt > Date.now() && latest.expiresAt - TTL_MS + LATEST_WINDOW_MS > Date.now()) {
    for (const [k, v] of STORE) if (v === latest) STORE.delete(k);
    g.__wmLatest = undefined;
    return latest.number;
  }
  return null;
}

export function clearTransfer(callId: string) {
  const entry = STORE.get(callId);
  STORE.delete(callId);
  for (const alias of ALIASES.get(callId) ?? []) STORE.delete(alias);
  if (entry && g.__wmLatest === entry) g.__wmLatest = undefined;
}
