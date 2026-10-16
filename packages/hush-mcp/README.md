# hush-mcp

MCP server for [HUSH](https://hushagents.com): your agent browses the Agent Shop and pays per call over **private x402 on Solana**. Every call pays a one-time stealth address; spending stays inside the limits you set (daily budget, per-call cap, allowlist, kill switch).

```bash
npx -y hush-mcp
```

## Setup

1. Open https://hushagents.com/app, connect Phantom, create an agent, fund it with a little SOL, and copy its **agent key** (`hush_...`, shown once).
2. Add the server to your client with `HUSH_AGENT_KEY`.

Without a key the read-only tools (`hush_shop`, `hush_stats`, `hush_receipts`) still work; `hush_buy` needs the key.

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "hush": {
      "command": "npx",
      "args": ["-y", "hush-mcp"],
      "env": { "HUSH_AGENT_KEY": "hush_..." }
    }
  }
}
```

### Cursor

`~/.cursor/mcp.json` (or `.cursor/mcp.json` in a project): same JSON as above.

### Claude Code

```bash
claude mcp add hush --env HUSH_AGENT_KEY=hush_... -- npx -y hush-mcp
```

## Tools

| Tool | What it does | Spends |
|---|---|---|
| `hush_shop` | Lists listings: id, seller, price, Hush Score | no |
| `hush_buy` | Buys one call (`listing`, optional `input`), pays a one-time address, returns the answer | yes, within your leash |
| `hush_stats` | Agent GDP (aggregate) and seller scores with their anchored epoch roots | no |
| `hush_receipts` | Latest public receipts (commitments only) | no |

## Env

| Var | Default |
|---|---|
| `HUSH_URL` | `https://hushagents.com` |
| `HUSH_AGENT_KEY` | none (needed for `hush_buy`) |

Limits: privacy hides which seller was paid, not your agent's wallet. Not zero-knowledge. MIT · [source](https://github.com/bigrceo/hush)
