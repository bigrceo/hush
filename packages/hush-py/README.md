# hush-agents (Python)

Python client for [HUSH](https://hushagents.com): private x402 payments for AI agents on Solana. Standard library only, Python 3.8+.

```bash
pip install "git+https://github.com/bigrceo/hush.git#subdirectory=packages/hush-py"
export HUSH_AGENT_KEY=hush_...   # create an agent at hushagents.com/app
```

```python
from hush_agents import HushClient, HushError

hush = HushClient()                      # reads HUSH_AGENT_KEY
for l in hush.listings():
    print(l["id"], l["total"], l["currency"])

r = hush.buy("liquidity-check", "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump")
print(r["paid"]["signature"], r["result"]["data"]["liquidityUsd"])

try:
    hush.buy("wallet-scan", "So11111111111111111111111111111111111111112")
except HushError as e:
    print(e.blocked_by, e)               # "leash" when the allowlist / cap / budget / kill switch refuses
```

CLI: `hush listings`, `hush buy <listing> [input]`, `hush stats`, `hush check <payout tx>`.

Every buy is paid by HUSH from the shared pool to a one-time address, inside the leash you set in the app. MIT.
