# HUSH listings kit (not submitted yet)

Everything below is ready to paste. Publish the npm packages first (the registry and most directories check that `hush-mcp` exists on npm).

## 0. npm (run by the owner)

```bash
npm login                                   # once
cd packages/hush-gate && npm publish        # runs build + tests first (prepublishOnly)
cd ../hush-mcp && npm publish
```

Names checked free on 2026-10-16: `hush-mcp`, `hush-gate` (fallbacks also free: `@hushagents/mcp`, `@hushagents/gate`; if you switch to them, rename in package.json and use `npm publish --access public`). After publishing, set `NEXT_PUBLIC_NPM_LIVE=1` on Vercel production and redeploy so /docs drops the "coming to npm" note.

## 1. Official MCP Registry (registry.modelcontextprotocol.io)

`packages/hush-mcp/server.json` is ready; `package.json` already carries `"mcpName": "io.github.bigrceo/hush"` (the registry checks it).

```bash
brew install mcp-publisher        # or: curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher
cd packages/hush-mcp
mcp-publisher login github        # device flow as bigrceo (namespace io.github.bigrceo/*)
mcp-publisher publish
curl "https://registry.modelcontextprotocol.io/v0/servers?search=io.github.bigrceo/hush"
```

## 2. Smithery (smithery.ai)

Submit at https://smithery.ai/new → "Add server" → GitHub repo `bigrceo/hush`, base directory `packages/hush-mcp`. If it asks for a config, add `packages/hush-mcp/smithery.yaml`:

```yaml
startCommand:
  type: stdio
  configSchema:
    type: object
    properties:
      hushAgentKey: { type: string, description: "Agent key from hushagents.com/app (needed for hush_buy)" }
      hushUrl: { type: string, default: "https://hushagents.com" }
  commandFunction: |-
    (config) => ({ command: "npx", args: ["-y", "hush-mcp"], env: { HUSH_AGENT_KEY: config.hushAgentKey || "", HUSH_URL: config.hushUrl || "https://hushagents.com" } })
```

Display name: HUSH · Short description: Private x402 payments for AI agents on Solana.

## 3. Glama (glama.ai/mcp/servers)

https://glama.ai/mcp/servers → "Add Server" → `https://github.com/bigrceo/hush`.
- Name: HUSH
- Description: Let your agent buy from other agents per call over x402 on Solana. Each call pays a one-time stealth address, receipts stay private and are rolled into Merkle roots anchored on Solana. Spending is capped by a server-side leash (daily budget, per-call cap, allowlist, kill switch).
- Categories: Finance, Blockchain/Crypto, Agent payments
- Install: `npx -y hush-mcp` · env `HUSH_AGENT_KEY`

## 4. mcp.so

https://mcp.so/submit
- Name: HUSH
- URL: https://github.com/bigrceo/hush
- Category: Finance / Crypto
- Description: Private x402 payments for AI agents on Solana. Tools: hush_shop, hush_buy, hush_stats, hush_receipts. One-time stealth payees per call, private receipts anchored as Merkle roots on Solana, leashed agent wallets.
- Server config:
```json
{ "mcpServers": { "hush": { "command": "npx", "args": ["-y", "hush-mcp"], "env": { "HUSH_AGENT_KEY": "hush_..." } } } }
```

## 5. awesome-mcp-servers (punkpeye) PR

Fork https://github.com/punkpeye/awesome-mcp-servers, add one line in **💰 Finance & Fintech**, alphabetical order (their legend: 📇 TypeScript, ☁️ cloud service, 🏠 local):

```markdown
- [bigrceo/hush](https://github.com/bigrceo/hush) 📇 ☁️ - Private x402 payments for AI agents on Solana: browse an agent shop and pay per call to one-time stealth addresses, with a server-side spending leash and receipts anchored as Merkle roots on Solana.
```

PR title: `Add HUSH (private x402 agent payments on Solana)`

PR body:

> Adds HUSH, an MCP server (`npx -y hush-mcp`) that lets agents buy from other agents per call over x402 on Solana. Each call pays a one-time stealth address; receipts stay private and are committed to Merkle roots anchored on Solana (verifiable at hushagents.com/verify). Spending is limited by a server-side leash (daily budget, per-call cap, allowlist, kill switch). MIT, source at github.com/bigrceo/hush. Read-only tools work without a key.
