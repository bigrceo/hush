// Small primitives shared by Hush Gate and the app. WebCrypto + tweetnacl only, so it runs on Workers.
import nacl from "tweetnacl";
import { Keypair } from "@solana/web3.js";

const enc = new TextEncoder();

export async function hmac(secret: string, msg: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

export async function sha256Hex(msg: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(msg)));
  return toHex(d);
}

export const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

export function b64url(b: Uint8Array | string): string {
  const bytes = typeof b === "string" ? enc.encode(b) : b;
  let s = "";
  bytes.forEach((x) => (s += String.fromCharCode(x)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(s: string): string {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(pad);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Deterministic ed25519 keypair from (secret, label). Used for one-time stealth payees and agent wallets. */
export async function deriveKeypair(secret: string, label: string): Promise<Keypair> {
  const seed = await hmac(secret, "hush/kp/" + label);
  const kp = nacl.sign.keyPair.fromSeed(seed.slice(0, 32));
  return Keypair.fromSecretKey(kp.secretKey);
}

export function randomId(n = 12): string {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return toHex(b);
}

export function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function aesKey(secret: string) {
  const raw = await hmac(secret, "hush/aes/v1");
  return crypto.subtle.importKey("raw", new Uint8Array(raw), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
const bytesToB64u = (b: Uint8Array) => b64url(b);
function b64uToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Uint8Array.from(atob(pad), (c) => c.charCodeAt(0));
}
/** AES-256-GCM with a key derived from HUSH_SECRET. Output: iv.ciphertext (base64url). */
export async function seal(secret: string, data: Uint8Array): Promise<string> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(secret), new Uint8Array(data)));
  return bytesToB64u(iv) + "." + bytesToB64u(ct);
}
export async function unseal(secret: string, sealed: string): Promise<Uint8Array> {
  const [iv, ct] = sealed.split(".");
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(b64uToBytes(iv)) }, await aesKey(secret), new Uint8Array(b64uToBytes(ct))));
}
