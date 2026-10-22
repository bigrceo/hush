import { ImageResponse } from "next/og";
import { walletLeaks } from "@/lib/walletleak";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Wallet leak scan · HUSH";
export const maxDuration = 30;

export default async function Image({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const r = await walletLeaks(address).catch(() => null);
  const short = `${address.slice(0, 4)}…${address.slice(-4)}`;
  const rows = r ? [
    ["Addresses it paid", String(r.top.filter((p) => p.out).length)],
    ["Repeat payees", String(r.repeatPayees)],
    ["Spent", `${r.spentSol.toFixed(3)} SOL`],
    ["Most active", `${String(r.busiestHourUtc).padStart(2, "0")}:00 UTC`],
  ] : [];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#07060a", color: "#f5f3fa", padding: 70, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 560 }}>
          <div style={{ fontSize: 22, letterSpacing: 4, color: "#9b7bff" }}>HUSH · WALLET LEAK SCAN</div>
          <div style={{ marginTop: 40, fontSize: 70, fontWeight: 700, lineHeight: 1.02 }}>{short}</div>
          <div style={{ fontSize: 70, fontWeight: 700, lineHeight: 1.02, color: "#9b7bff" }}>is an open diary.</div>
          <div style={{ marginTop: 30, fontSize: 30, color: "#b9b3c9" }}>{r ? `${r.leaks.length} things a stranger reads from ${r.scanned} transactions` : "See what a stranger reads"}</div>
          <div style={{ marginTop: "auto", fontSize: 26, color: "#b9b3c9" }}>scan yours · hushagents.com/leaks</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 50, flex: 1, justifyContent: "center", gap: 18 }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #2a2438", paddingBottom: 14, fontSize: 30 }}>
              <span style={{ color: "#b9b3c9" }}>{k}</span><span style={{ color: "#ff8a8a", fontWeight: 700 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
