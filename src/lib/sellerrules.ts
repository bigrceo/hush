// Pure validation for self-serve seller listings (unit-tested in test/sellers.test.ts).
export const SELLER_LIMITS = { minLamports: 1_000_000, maxLamports: 100_000_000, maxPerOwner: 5, nameMax: 48, descMax: 240, timeoutMs: 10_000, maxBytes: 256_000 };

const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i;
function privateIp(h: string) {
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224 || (a === 100 && b >= 64 && b <= 127);
  }
  return h.includes(":"); // any IPv6 literal is refused
}

export type SellerInput = { name: string; url: string; priceSol: number; description: string; input?: string };

/** Returns an error message, or null if the listing is acceptable. */
export function validateSeller(x: SellerInput, blockedHosts: string[] = []): string | null {
  if (!x.name || x.name.trim().length < 3 || x.name.length > SELLER_LIMITS.nameMax) return `name must be 3-${SELLER_LIMITS.nameMax} chars`;
  if (!x.description || x.description.trim().length < 10 || x.description.length > SELLER_LIMITS.descMax) return `description must be 10-${SELLER_LIMITS.descMax} chars`;
  const bad = checkHttpsUrl(x.url, blockedHosts);
  if (bad) return bad;
  const lamports = Math.round(x.priceSol * 1e9);
  if (!Number.isFinite(lamports) || lamports < SELLER_LIMITS.minLamports || lamports > SELLER_LIMITS.maxLamports) return `price must be between ${SELLER_LIMITS.minLamports / 1e9} and ${SELLER_LIMITS.maxLamports / 1e9} SOL`;
  if (x.input && !/^[a-z][a-z0-9_]{0,23}$/i.test(x.input)) return "input must be a simple parameter name";
  return null;
}

/** Public https URL check (no credentials, default port, no private/loopback hosts). Returns an error or null. */
export function checkHttpsUrl(url: string, blockedHosts: string[] = []): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return "url is not valid"; }
  if (u.protocol !== "https:") return "url must be https";
  if (u.username || u.password) return "url must not contain credentials";
  if (u.port && u.port !== "443") return "url must use the default https port";
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (PRIVATE_HOST.test(host) || privateIp(host) || !host.includes(".")) return "url host is not allowed";
  if (blockedHosts.some((b) => host === b || host.endsWith("." + b))) return "url host is not allowed";
  return null;
}
