import { Header, Footer } from "@/components/brand";
import Leaks from "./leaks";

export const metadata = { title: "Wallet leak scan · HUSH", description: "Paste any Solana wallet and see what a stranger learns from its history: who it pays, who pays it, how much, and when. Live mainnet." };

export default function Page() {
  return (<><Header /><Leaks /><Footer /></>);
}
