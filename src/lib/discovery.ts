import { listingTotal, type Listing } from "@/lib/shop";
import { allListings } from "@/lib/sellers";
import { CLUSTER, NETWORK_ID } from "@/lib/config";

// Machine-readable catalog of every paid endpoint, for agents and x402 indexers that crawl
// /.well-known/x402 or /llms.txt instead of reading the site.
export const ORIGIN = "https://hushagents.com";

export function resource(l: Listing) {
  const total = listingTotal(l);
  return {
    id: l.id,
    name: l.name,
    description: l.blurb,
    seller: l.seller,
    kind: l.kind,
    method: "GET",
    resource: `${ORIGIN}/api/shop/${l.id}`,
    input: l.input ? { in: "query", name: l.input, required: true } : null,
    price: { amount: +total.toFixed(9), currency: l.currency, legs: l.legs?.length ?? 1 },
    accepts: { x402Version: 1, scheme: "exact", network: NETWORK_ID, privacy: "stealth-one-time-payee" },
    selfServe: l.id.startsWith("s-"),
  };
}

export async function catalog() {
  const resources = (await allListings()).map(resource);
  return {
    x402Version: 1,
    name: "HUSH",
    description: "Private x402 payments for AI agents on Solana. Every call is paid to a one-time payee address.",
    origin: ORIGIN,
    network: NETWORK_ID,
    cluster: CLUSTER,
    flow: [
      "GET a resource without X-PAYMENT: you get HTTP 402 with signed payment requirements (accepts[0]).",
      "Pay every leg in accepts[0].extra.legs in one Solana transaction, to the one-time payTo addresses.",
      "Retry the same GET with X-PAYMENT: base64url JSON {quote, signature}. Paid response, or an escrow refund if the seller fails.",
    ],
    clients: {
      mcp: "npx -y hush-mcp",
      python: "pip install \"git+https://github.com/bigrceo/hush.git#subdirectory=packages/hush-py\"",
      docs: `${ORIGIN}/docs`,
    },
    count: resources.length,
    resources,
    updatedAt: new Date().toISOString(),
  };
}

export async function llmsTxt() {
  const c = await catalog();
  const line = (r: ReturnType<typeof resource>) =>
    `- [${r.name}](${r.resource}${r.input ? `?${r.input.name}=<${r.input.name}>` : ""}): ${r.description} Price ${r.price.amount} ${r.price.currency}.`;
  const shop = c.resources.filter((r) => !r.selfServe);
  const sellers = c.resources.filter((r) => r.selfServe);
  return [
    "# HUSH",
    "",
    `> ${c.description} Network: ${c.network}. Machine-readable catalog: ${ORIGIN}/.well-known/x402`,
    "",
    "## How to pay",
    "",
    ...c.flow.map((f, i) => `${i + 1}. ${f}`),
    "",
    "## Agent Shop",
    "",
    ...shop.map(line),
    ...(sellers.length ? ["", "## Self-serve sellers", "", ...sellers.map(line)] : []),
    "",
    "## Docs",
    "",
    `- [Docs](${ORIGIN}/docs): MCP server, Python client, seller guide`,
    `- [Stats](${ORIGIN}/stats): public paid-call stats`,
    `- [Proof](${ORIGIN}/proof): privacy proof of the payment flow`,
    "",
  ].join("\n");
}
