import { DocLayout, Code } from "@/components/doc";
export const metadata = { title: "HUSH Docs" };
const NPM_LIVE = process.env.NEXT_PUBLIC_NPM_LIVE === "1";
const soon = NPM_LIVE ? null : <p className="label label-hush">Coming to npm · meanwhile run from source: github.com/bigrceo/hush/tree/main/packages</p>;

export default function Docs() {
  return (
    <DocLayout kicker="Docs" title="Build with" hush="HUSH." intro="Sell an endpoint privately, give an agent a leashed wallet, and let Claude shop over MCP. Everything below runs today on Solana mainnet."
      sections={[
        { id: "developers", title: "Developers", body: <>
          {soon}
          <p><strong className="text-fg">Give your agent a wallet that pays privately.</strong> The MCP server plugs HUSH into Claude, Cursor or Claude Code. Read-only tools work with no key; buying needs an agent key from the app.</p>
          <Code label="Claude Code">{`claude mcp add hush --env HUSH_AGENT_KEY=hush_... -- npx -y hush-mcp`}</Code>
          <Code label="Claude Desktop / Cursor">{`{ "mcpServers": { "hush": { "command": "npx", "args": ["-y", "hush-mcp"],
  "env": { "HUSH_AGENT_KEY": "hush_..." } } } }`}</Code>
          <p><strong className="text-fg">Sell your own endpoint.</strong> <code>hush-x402</code> is the same middleware this site runs, standalone: your secret, your RPC, your one-time addresses.</p>
          <Code label="npm i hush-x402">{`import { sell } from "hush-x402";

export const GET = sell(
  { secret: process.env.HUSH_SECRET!, rpcUrl: process.env.RPC_URL,
    price: "0.001", resource: "/api/forecast", seller: "forecast-lab" },
  async () => Response.json({ tomorrow: "sunny" }),
);`}</Code></> },
        { id: "quickstart", title: "Quickstart", body: <>
          <p>1. Open the app, connect Phantom, sign in. 2. Create an agent, copy its API key. 3. Fund it with SOL from Phantom. 4. Allowlist a seller and press Buy. The agent gets a 402, pays a one-time address, and the gate serves the answer.</p>
          <Code label="curl">{`curl -X POST https://<host>/api/agent/buy \\
  -H "x-agent-key: hush_…" -H "content-type: application/json" \\
  -d '{"listing":"market-brief"}'`}</Code></> },
        { id: "x402", title: "Private x402 flow", body: <>
          <p>A call without payment gets <code>402</code> and an <code>accepts</code> array, x402 style. HUSH adds <code>extra.legs</code>: one stealth <code>payTo</code> per seller, derived from the gate secret and a fresh nonce, plus a signed <code>quote</code>.</p>
          <Code label="402 body">{`{ "x402Version": 1, "accepts": [{
  "scheme": "exact", "network": "solana", "currency": "SOL",
  "asset": "native", "maxAmountRequired": "3000000",
  "extra": { "privacy": "stealth-one-time-payee", "quote": "eyJ2Ijox…",
    "legs": [{ "seller": "oracle.hush", "amount": "1000000", "payTo": "8sQ2…" }, …] } }] }`}</Code>
          <p>The client pays every leg in one transaction, then retries with <code>X-PAYMENT: base64url({`{quote, signature}`})</code>. The gate re-derives each address, reads the transaction over RPC, checks amounts, asset, expiry and replay, and serves.</p></> },
        { id: "gate", title: "Hush Gate (sellers)", body: <>
          <p>Framework-agnostic: it wraps any <code>(Request) =&gt; Response</code>. Next.js route handlers, Hono, Workers, Bun.</p>
          <Code label="app/api/forecast/route.ts">{`import { hushGate } from "@hush/gate";

export const GET = hushGate({
  resource: "/api/forecast", price: "0.001", currency: "SOL", seller: "forecast-lab",
  secret: process.env.HUSH_SECRET!, rpcUrl: process.env.RPC_URL!,
  network: "solana", usdcMint: "EPjFWdd5AufqSSqeM2qZqWAquxHnWsZXsP6ehNkN5Mkj6",
  onReceipt: (r) => saveReceipt(r),
}, async () => Response.json(await forecast()));`}</Code>
          <p>Composite: pass <code>legs: [{`{ seller, amount }`}, …]</code> instead of <code>price</code>. USDC: <code>currency: "USDC"</code>; buyers pay into each payee&apos;s associated token account.</p></> },
        { id: "escrow", title: "Per-call escrow", body: <p>Funds sit on the one-time address, which only the gate can sign for. If your handler throws or returns non-2xx, the gate refunds the payer (SOL) from the stealth key and answers <code>502</code> with the refund signature. Sellers sweep settled addresses on their own schedule.</p> },
        { id: "buyers", title: "Buyers & agents", body: <>
          <Code label="agent.ts">{`import { hushFetch } from "@hush/gate/client";
const { res } = await hushFetch(url, { keypair, rpcUrl,
  approve: (req) => BigInt(req.maxAmountRequired) <= 1_000_000n });`}</Code></> },
        { id: "leash", title: "Leash", body: <p>Each agent wallet is derived server-side and funded by its owner. Before any payment the server checks: kill switch (agent and owner-wide), allowlist, per-call cap, daily budget. The check runs twice, against the list price and against the seller&apos;s actual 402. Owners edit limits with a Phantom-signed session.</p> },
        { id: "mcp", title: "MCP server", body: <>
          <p>A stdio MCP server ships in <code>mcp/server.mjs</code>. Tools: <code>hush_shop</code>, <code>hush_buy</code>, <code>hush_wallet</code>, <code>hush_receipts</code>.</p>
          <Code label="claude_desktop_config.json">{`{ "mcpServers": { "hush": { "command": "node", "args": ["/path/to/hush/mcp/server.mjs"],
  "env": { "HUSH_URL": "http://localhost:4048", "HUSH_AGENT_KEY": "hush_…" } } } }`}</Code></> },
        { id: "score", title: "Hush Score & receipts", body: <p>Every verified call yields a receipt. Publicly only its commitment <code>sha256(nonce|signature|payer)</code> exists. Hush Score (0 to 1000) weighs success rate, latency and refund rate, and lists the epoch roots its receipts live in. Owners see full receipts of their own agents.</p> },
        { id: "verify", title: "Verifiable receipts", body: <>
          <p>Private, but verifiable. Unsealed receipts are rolled into an epoch every hour: <code>leaf = sha256(&quot;hush-leaf-v1:&quot; + commitment)</code>, <code>node = sha256(0x01 | left | right)</code>, an odd node carries up. The root is anchored on Solana with an SPL Memo signed by the publisher key (<code>/api/publisher</code>):</p>
          <Code>{`HUSH receipts root v1 <epoch> <root> <leafCount>`}</Code>
          <p>Owners download a proof per receipt from the app (<code>GET /api/receipts/:nonce/proof</code>): commitment, leaf, Merkle path, epoch, root and anchor tx. <a className="hush-text underline" href="/verify">/verify</a> recomputes the root in your browser, reads the memo from Solana and checks the signer. No other receipt is revealed. Epoch roots are public at <code>/api/epochs</code>. This is hashing plus on-chain anchoring; there is no zero-knowledge proof involved.</p></> },
        { id: "api", title: "HTTP API", body: <Code>{`GET  /api/shop                 listings + scores
GET  /api/shop/:id             Hush-Gated seller endpoint (402)
POST /api/auth                 { pubkey, ts, signature } -> session
GET  /api/agents | POST        list / create (owner)
PATCH /api/agents/:id          dailyBudget, perCallCap, allowlist, frozen
POST /api/agents/:id/withdraw  sweep agent SOL to owner
POST /api/agents/freeze-all    { on }
POST /api/agent/buy            { listing, input?, agentId? }  x-agent-key
GET  /api/receipts             public commitments | owner receipts
GET  /api/receipts/:nonce/proof inclusion proof (owner)
GET  /api/epochs               epoch roots + anchor txs
GET  /api/publisher            publisher address
GET  /api/stats                Agent GDP + Hush Scores`}</Code> },
      ]} />
  );
}
