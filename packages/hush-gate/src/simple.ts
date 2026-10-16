import { hushGate, type Currency, type GateOptions, type GateReceipt } from "./index";

export interface SellOptions {
  /** Your own secret (32+ random bytes, hex). Derives every one-time payee; keep it safe, it is how you sweep. */
  secret: string;
  /** Solana RPC URL. Defaults to mainnet-beta public RPC. */
  rpcUrl?: string;
  cluster?: "mainnet-beta" | "devnet";
  /** Price per call, e.g. "0.001". */
  price: string;
  currency?: Currency;
  /** Resource path the gate protects (must match the route). */
  resource: string;
  seller?: string;
  description?: string;
  onReceipt?: (r: GateReceipt) => void | Promise<void>;
  /** Replay guard; default is in-memory (single instance). Use your DB in production. */
  claimSignature?: GateOptions["claimSignature"];
}

const USDC = { "mainnet-beta": "EPjFWdd5AufqSSqeM2qZqWAquxHnWsZXsP6ehNkN5Mkj6", devnet: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" };

/** One-call helper: wrap a Web `Request => Response` handler so each call costs `price`, paid privately. */
export function sell(o: SellOptions, handler: (req: Request, ctx: { payer: string; nonce: string }) => Promise<Response>) {
  const cluster = o.cluster ?? "mainnet-beta";
  if (!o.secret || o.secret.length < 32) throw new Error("hush-x402: `secret` must be at least 32 characters");
  return hushGate(
    {
      resource: o.resource,
      description: o.description,
      currency: o.currency ?? "SOL",
      price: o.price,
      seller: o.seller,
      secret: o.secret,
      rpcUrl: o.rpcUrl ?? (cluster === "mainnet-beta" ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com"),
      network: cluster === "mainnet-beta" ? "solana" : "solana-devnet",
      usdcMint: USDC[cluster],
      onReceipt: o.onReceipt,
      claimSignature: o.claimSignature,
    },
    handler,
  );
}
