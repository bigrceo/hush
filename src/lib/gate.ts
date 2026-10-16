// App-level wiring of Hush Gate for the shop's own sellers.
import { hushGate, type GateOptions } from "@/gate";
import { HUSH_SECRET, NETWORK_ID, RPC_URL, USDC_MINT } from "./config";
import { addReceipt, claimSignature } from "./store";
import type { Listing } from "./shop";

export function gateFor(l: Listing, handler: Parameters<typeof hushGate>[1]) {
  const o: GateOptions = {
    resource: `/api/shop/${l.id}`,
    description: l.name,
    currency: l.currency,
    price: l.price,
    seller: l.seller,
    legs: l.legs,
    secret: HUSH_SECRET,
    rpcUrl: RPC_URL,
    network: NETWORK_ID,
    usdcMint: USDC_MINT,
    claimSignature, // replay guard in D1
    onReceipt: async (r) => {
      await addReceipt(r, l.id); // agent id is attached by /api/agent/buy
    },
  };
  return hushGate(o, handler);
}
