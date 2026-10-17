"use client";
// One wallet interface for the app: every Wallet Standard wallet (Phantom, Solflare, Backpack, ...) plus
// legacy injected providers as a fallback for older extensions.
import { getWallets } from "@wallet-standard/app";
import { Connection, Transaction } from "@solana/web3.js";
import bs58 from "bs58";

export interface HushWallet {
  name: string;
  icon: string;
  connect(): Promise<string>; // base58 address
  signMessage(msg: Uint8Array): Promise<Uint8Array>;
  /** Signs and broadcasts a legacy transaction; returns the base58 signature. */
  signAndSend(tx: Transaction, conn: Connection): Promise<string>;
}

type StdAccount = { address: string; publicKey: Uint8Array; chains: readonly string[]; features: readonly string[] };
type StdWallet = {
  name: string;
  icon: string;
  chains: readonly string[];
  accounts: readonly StdAccount[];
  features: Record<string, { [k: string]: unknown }>;
};

const CHAIN = (process.env.NEXT_PUBLIC_CLUSTER || "devnet") === "mainnet-beta" ? "solana:mainnet" : "solana:devnet";
const need = ["standard:connect", "solana:signMessage"];

function fromStandard(w: StdWallet): HushWallet {
  let account: StdAccount | null = null;
  const f = w.features as Record<string, Record<string, (...a: unknown[]) => Promise<unknown>>>;
  return {
    name: w.name,
    icon: w.icon,
    async connect() {
      const r = (await f["standard:connect"].connect()) as { accounts: readonly StdAccount[] };
      account = r.accounts[0] ?? w.accounts[0] ?? null;
      if (!account) throw new Error(`${w.name} returned no account`);
      return account.address;
    },
    async signMessage(message) {
      if (!account) await this.connect();
      const [out] = (await f["solana:signMessage"].signMessage({ account, message })) as { signature: Uint8Array }[];
      return out.signature;
    },
    async signAndSend(tx, conn) {
      if (!account) await this.connect();
      const transaction = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      if (f["solana:signAndSendTransaction"]) {
        const [out] = (await f["solana:signAndSendTransaction"].signAndSendTransaction({ account, chain: CHAIN, transaction })) as { signature: Uint8Array }[];
        return bs58.encode(out.signature);
      }
      const [out] = (await f["solana:signTransaction"].signTransaction({ account, chain: CHAIN, transaction })) as { signedTransaction: Uint8Array }[];
      return conn.sendRawTransaction(out.signedTransaction);
    },
  };
}

type Legacy = {
  publicKey?: { toBase58(): string } | null;
  connect(): Promise<{ publicKey?: { toBase58(): string } } | void>;
  signMessage(m: Uint8Array, e?: string): Promise<{ signature: Uint8Array } | Uint8Array>;
  signAndSendTransaction?(t: Transaction): Promise<{ signature: string }>;
  signTransaction?(t: Transaction): Promise<Transaction>;
};

function fromLegacy(name: string, icon: string, p: Legacy): HushWallet {
  return {
    name,
    icon,
    async connect() {
      const r = await p.connect();
      const k = (r && "publicKey" in r && r.publicKey) || p.publicKey;
      if (!k) throw new Error(`${name} returned no account`);
      return k.toBase58();
    },
    async signMessage(m) {
      const r = await p.signMessage(m, "utf8");
      return r instanceof Uint8Array ? r : r.signature;
    },
    async signAndSend(tx, conn) {
      if (p.signAndSendTransaction) return (await p.signAndSendTransaction(tx)).signature;
      const signed = await p.signTransaction!(tx);
      return conn.sendRawTransaction(signed.serialize());
    },
  };
}

/** Every usable wallet in this browser, Wallet Standard first, de-duplicated by name. */
export function detectWallets(): HushWallet[] {
  if (typeof window === "undefined") return [];
  const out: HushWallet[] = [];
  for (const w of getWallets().get() as unknown as StdWallet[]) {
    if (!w.chains.some((c) => c.startsWith("solana:"))) continue;
    if (!need.every((n) => n in w.features)) continue;
    if (!("solana:signAndSendTransaction" in w.features) && !("solana:signTransaction" in w.features)) continue;
    out.push(fromStandard(w));
  }
  const win = window as unknown as { phantom?: { solana?: Legacy }; solflare?: Legacy & { isSolflare?: boolean }; backpack?: Legacy };
  const legacy: [string, Legacy | undefined][] = [["Phantom", win.phantom?.solana], ["Solflare", win.solflare], ["Backpack", win.backpack]];
  for (const [name, p] of legacy) if (p && !out.some((w) => w.name.toLowerCase().startsWith(name.toLowerCase()))) out.push(fromLegacy(name, "", p));
  return out;
}

/** Re-evaluates the list when a wallet registers late (extensions inject after page load). */
export function onWalletsChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const w = getWallets();
  const off1 = w.on("register", cb);
  const off2 = w.on("unregister", cb);
  return () => { off1(); off2(); };
}

export const INSTALL = [
  { name: "Phantom", url: "https://phantom.com/download" },
  { name: "Solflare", url: "https://solflare.com/download" },
  { name: "Backpack", url: "https://backpack.app/download" },
];
