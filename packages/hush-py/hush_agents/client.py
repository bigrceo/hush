import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

DEFAULT_BASE = "https://hushagents.com"


class HushError(Exception):
    """Raised on any non-2xx answer. `status` is the HTTP code, `blocked_by` is "leash" when the leash refused."""

    def __init__(self, message: str, status: int = 0, blocked_by: Optional[str] = None):
        super().__init__(message)
        self.status = status
        self.blocked_by = blocked_by


class HushClient:
    """Agent-side client. Payments are made by HUSH from the shared pool, within your agent's leash.

    >>> hush = HushClient(os.environ["HUSH_AGENT_KEY"])
    >>> hush.buy("sol-price")["result"]["data"]
    """

    def __init__(self, agent_key: Optional[str] = None, base_url: Optional[str] = None, timeout: float = 90.0):
        self.agent_key = agent_key or os.environ.get("HUSH_AGENT_KEY")
        self.base_url = (base_url or os.environ.get("HUSH_URL") or DEFAULT_BASE).rstrip("/")
        self.timeout = timeout

    def _req(self, method: str, path: str, body: Optional[Dict[str, Any]] = None, auth: bool = False) -> Any:
        headers = {"accept": "application/json", "user-agent": "hush-agents-py/0.1"}
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            headers["content-type"] = "application/json"
        if auth:
            if not self.agent_key:
                raise HushError("agent key missing: pass HushClient(agent_key) or set HUSH_AGENT_KEY")
            headers["x-agent-key"] = self.agent_key
        req = urllib.request.Request(self.base_url + path, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                return json.loads(r.read().decode() or "null")
        except urllib.error.HTTPError as e:
            try:
                j = json.loads(e.read().decode())
            except Exception:
                j = {}
            raise HushError(j.get("error") or str(e), e.code, j.get("blockedBy")) from None

    # Public
    def listings(self) -> List[Dict[str, Any]]:
        """Every Agent Shop listing (built-in and self-serve) with price and endpoint."""
        return self._req("GET", "/api/shop")["listings"]

    def stats(self) -> Dict[str, Any]:
        """Public usage stats (counts only)."""
        return self._req("GET", "/api/stats/daily")

    def privacy_check(self, tx: str) -> Dict[str, Any]:
        """Unlinkability check of any payout transaction."""
        return self._req("GET", "/api/privacy/check?tx=" + urllib.parse.quote(tx))

    # Agent (needs the agent key)
    def buy(self, listing: str, input: Optional[str] = None) -> Dict[str, Any]:
        """Buys one call of a listing. HUSH pays privately from the pool and returns the seller's answer.

        Returns {"ok", "listing", "paid": {"signature", "amount", ...}, "ms", "result"}.
        Raises HushError(blocked_by="leash") when the allowlist, cap, budget or kill switch refuses.
        """
        body: Dict[str, Any] = {"listing": listing}
        if input is not None:
            body["input"] = input
        return self._req("POST", "/api/agent/buy", body, auth=True)
