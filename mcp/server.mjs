#!/usr/bin/env node
// HUSH MCP server (stdio): lets Claude / Cursor / any MCP client shop the Agent Shop with a leashed agent wallet.
// env: HUSH_URL (default http://localhost:4048), HUSH_AGENT_KEY (from the dApp, shown once at agent creation).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = (process.env.HUSH_URL || "http://localhost:4048").replace(/\/$/, "");
const KEY = process.env.HUSH_AGENT_KEY || "";
const text = (o) => ({ content: [{ type: "text", text: typeof o === "string" ? o : JSON.stringify(o, null, 2) }] });

async function call(path, init = {}) {
  const r = await fetch(BASE + path, { ...init, headers: { "content-type": "application/json", "x-agent-key": KEY, ...(init.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ...j };
}

const server = new McpServer({ name: "hush", version: "0.1.0" });

server.tool("hush_shop", "List the HUSH Agent Shop: private, pay-per-call endpoints sold by other agents (SOL/USDC on Solana).", {}, async () => {
  const j = await call("/api/shop");
  return text(j.listings.map((l) => ({ id: l.id, name: l.name, seller: l.seller, price: `${l.total} ${l.currency}`, input: l.input ?? null, blurb: l.blurb, hushScore: l.score })));
});

server.tool(
  "hush_buy",
  "Buy one call from the Agent Shop. Pays a one-time stealth address over x402 from your leashed agent wallet and returns the answer. Fails if the leash (budget, cap, allowlist, kill switch) blocks it.",
  { listing: z.string().describe("listing id from hush_shop"), input: z.string().optional().describe("address or mint, for listings that take one") },
  async ({ listing, input }) => {
    if (!KEY) return text("HUSH_AGENT_KEY is not set. Create an agent in the HUSH dApp and copy its key.");
    return text(await call("/api/agent/buy", { method: "POST", body: JSON.stringify({ listing, input }) }));
  },
);

server.tool("hush_stats", "Agent GDP (aggregate only) and Hush Scores of sellers.", {}, async () => text(await call("/api/stats")));

server.tool("hush_receipts", "Latest public receipts (commitments only, no addresses).", {}, async () => text(await call("/api/receipts")));

await server.connect(new StdioServerTransport());
