const API_BASE = "/api/registry";

/**
 * Register a NaCl public key for an address.
 * Writes to localStorage immediately and persists to the server registry.
 */
export function registerKey(address: string, publicKey: string): void {
  if (!address || !publicKey) return;
  localStorage.setItem(`spk:${address}`, publicKey);
  void fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, publicKey }),
  }).catch(() => {});
}

/**
 * Sync lookup from localStorage only.
 */
export function lookupKey(address: string): string | null {
  if (!address?.startsWith("0x")) return null;
  return localStorage.getItem(`spk:${address}`);
}

/**
 * Async lookup: checks localStorage first, then falls back to server registry.
 * Caches server results in localStorage for future lookups.
 */
export async function lookupKeyRemote(address: string): Promise<string | null> {
  if (!address?.startsWith("0x")) return null;

  const local = localStorage.getItem(`spk:${address}`);
  if (local) return local;

  try {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(address)}`);
    if (res.ok) {
      const data = (await res.json()) as { publicKey: string };
      localStorage.setItem(`spk:${address}`, data.publicKey);
      return data.publicKey;
    }
  } catch {
    // network offline — fall through
  }

  return null;
}
