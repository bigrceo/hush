import { Header, Footer } from "@/components/brand";
import { d1 } from "@/lib/store";
import { DEMO_AGENT_ID } from "@/lib/privacyproof";
import Compare from "./compare";

export const metadata = { title: "Compare · HUSH", description: "Paste any Solana payment and see what it reveals to a stranger, next to a HUSH payout. Live mainnet data." };
export const revalidate = 300;

async function examples() {
  try {
    const db = await d1();
    const pay = await db.prepare("SELECT signature, at FROM receipts WHERE agent_id = ? AND ok = 1 ORDER BY at DESC LIMIT 1").bind(DEMO_AGENT_ID).first<{ signature: string; at: string }>();
    const dep = await db.prepare("SELECT ref FROM ledger WHERE agent_id = ? AND kind = 'deposit' AND ref IS NOT NULL ORDER BY at DESC LIMIT 1").bind(DEMO_AGENT_ID).first<{ ref: string }>();
    return { wallet: dep?.ref ?? "", hush: pay?.signature ?? "" };
  } catch { return { wallet: "", hush: "" }; }
}

export default async function Page() {
  const ex = await examples();
  return (<><Header /><Compare walletExample={ex.wallet} hushExample={ex.hush} /><Footer /></>);
}
