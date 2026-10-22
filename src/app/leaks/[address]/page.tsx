import { Header, Footer } from "@/components/brand";
import Leaks from "../leaks";

export async function generateMetadata({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  return { title: `Wallet leak scan · ${address.slice(0, 4)}…${address.slice(-4)} · HUSH`, description: "What a stranger reads from this Solana wallet's history. Scan yours on hushagents.com/leaks." };
}

export default async function Page({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  return (<><Header /><Leaks initial={address} /><Footer /></>);
}
