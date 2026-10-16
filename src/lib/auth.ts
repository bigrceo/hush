// Owner sessions: Phantom signs a sign-in message, we hand back an HMAC session token.
import nacl from "tweetnacl";
import bs58 from "bs58";
import { b64url, fromB64url, hmac, timingSafeEqual } from "@/gate/crypto";
import { HUSH_SECRET } from "./config";

export const loginMessage = (pubkey: string, ts: number) => `Sign in to HUSH\nwallet: ${pubkey}\nts: ${ts}`;

export function verifyWalletSig(pubkey: string, message: string, sigB58: string) {
  try {
    return nacl.sign.detached.verify(new TextEncoder().encode(message), bs58.decode(sigB58), bs58.decode(pubkey));
  } catch {
    return false;
  }
}

export async function issueSession(pubkey: string) {
  const body = b64url(JSON.stringify({ pk: pubkey, exp: Date.now() + 7 * 86400_000 }));
  return body + "." + b64url(await hmac(HUSH_SECRET, "session/" + body));
}

export async function readSession(req: Request): Promise<string | null> {
  const h = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!h) return null;
  const [body, sig] = h.split(".");
  if (!body || !sig || !timingSafeEqual(sig, b64url(await hmac(HUSH_SECRET, "session/" + body)))) return null;
  const { pk, exp } = JSON.parse(fromB64url(body));
  return Date.now() < exp ? pk : null;
}
