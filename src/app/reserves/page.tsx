import { Header, Footer } from "@/components/brand";
import Reserves from "./reserves";

export const metadata = { title: "Reserves & custody · HUSH", description: "Live proof of reserves for the HUSH pool, and exactly what is and isn't custodial today." };

export default function Page() {
  return (<><Header /><Reserves /><Footer /></>);
}
