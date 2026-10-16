import { Header } from "@/components/brand";
import Dapp from "./dapp";
export const metadata = { title: "HUSH app" };
export default function Page() {
  return (<><Header />{process.env.NEXT_PUBLIC_CLUSTER !== "mainnet-beta" && <div className="border-b border-hush/40 bg-hush/10 px-4 py-2.5 text-center"><span className="label label-hush">Devnet beta</span><span className="label ml-3">Test SOL only · switch Phantom to devnet · mainnet at launch</span></div>}<Dapp /></>);
}
