import { Header, Footer } from "@/components/brand";
import Verify from "./verify";
export const metadata = { title: "Verify a receipt · HUSH", description: "Check that a HUSH receipt is included in a Merkle root anchored on Solana, in your browser, without revealing any other receipt." };
export default function Page() {
  return (<><Header /><Verify /><Footer /></>);
}
