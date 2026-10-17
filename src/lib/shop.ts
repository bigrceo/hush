import type { Currency, Leg } from "@/gate";

export interface Listing {
  id: string;
  name: string;
  seller: string;
  blurb: string;
  currency: Currency;
  price?: string;
  legs?: Leg[]; // composite
  input?: string; // query param name the endpoint takes
  kind: "data" | "model" | "scan" | "feed" | "composite";
}

export const LISTINGS: Listing[] = [
  { id: "sol-price", name: "SOL spot price", seller: "oracle.hush", blurb: "Live SOL/USD from two venues, median.", currency: "SOL", price: "0.001", kind: "feed" },
  { id: "network-pulse", name: "Network pulse", seller: "pulse.hush", blurb: "TPS, slot and epoch progress, straight from RPC.", currency: "SOL", price: "0.001", kind: "data" },
  { id: "wallet-scan", name: "Wallet scan", seller: "scan.hush", blurb: "Balance and recent activity of any address.", currency: "SOL", price: "0.002", input: "address", kind: "scan" },
  { id: "dev-check", name: "Dev check", seller: "scan.hush", blurb: "Any pump.fun mint: the creator wallet, what it still holds vs its initial buy, how many coins it launched recently, red flags.", currency: "SOL", price: "0.001", input: "mint", kind: "scan" },
  { id: "token-scan", name: "Token risk scan", seller: "scan.hush", blurb: "Any Solana or pump.fun mint: top-10 and largest holder %, bonding curve excluded, mint/freeze authority, supply, red flags.", currency: "SOL", price: "0.001", input: "mint", kind: "scan" },
  { id: "token-check", name: "Token check", seller: "scan.hush", blurb: "Supply, decimals and mint/freeze authority of any SPL mint.", currency: "SOL", price: "0.002", input: "mint", kind: "scan" },
  {
    id: "market-brief",
    name: "Market brief (composite)",
    seller: "brief.hush",
    blurb: "One call, three sellers paid in one transaction: price + pulse + a written brief.",
    currency: "SOL",
    legs: [
      { seller: "oracle.hush", amount: "0.001" },
      { seller: "pulse.hush", amount: "0.001" },
      { seller: "brief.hush", amount: "0.001" },
    ],
    kind: "composite",
  },
];

export const listing = (id: string) => LISTINGS.find((l) => l.id === id);
export const listingTotal = (l: Listing) =>
  l.legs ? l.legs.reduce((s, x) => s + +x.amount, 0) : +(l.price ?? 0);
