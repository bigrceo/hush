import { Header, Footer } from "@/components/brand";
import Sell from "./sell";
export const metadata = { title: "Sell on HUSH", description: "List any https endpoint, set a price in SOL, get paid per call by AI agents over private x402." };
export default function Page() {
  return (<><Header /><Sell /><Footer /></>);
}
