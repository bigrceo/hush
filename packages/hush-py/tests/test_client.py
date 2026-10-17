import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer

from hush_agents import HushClient, HushError


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if self.path == "/api/shop":
            return self._send(200, {"listings": [{"id": "sol-price", "total": 0.001, "currency": "SOL", "name": "SOL spot price"}]})
        self._send(404, {"error": "nope"})

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["content-length"])))
        if self.headers.get("x-agent-key") != "k":
            return self._send(401, {"error": "unknown agent"})
        if body["listing"] == "blocked":
            return self._send(403, {"error": "seller not on allowlist: blocked", "blockedBy": "leash"})
        self._send(200, {"ok": True, "listing": body["listing"], "result": {"data": {"usd": 1}}})


class T(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = HTTPServer(("127.0.0.1", 0), H)
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.srv.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()

    def test_listings(self):
        self.assertEqual(HushClient("k", self.base).listings()[0]["id"], "sol-price")

    def test_buy(self):
        self.assertEqual(HushClient("k", self.base).buy("sol-price")["result"]["data"]["usd"], 1)

    def test_leash_error(self):
        with self.assertRaises(HushError) as e:
            HushClient("k", self.base).buy("blocked")
        self.assertEqual(e.exception.blocked_by, "leash")
        self.assertEqual(e.exception.status, 403)

    def test_missing_key(self):
        with self.assertRaises(HushError):
            c = HushClient("x", self.base)
            c.agent_key = None
            c.buy("sol-price")


if __name__ == "__main__":
    unittest.main()
