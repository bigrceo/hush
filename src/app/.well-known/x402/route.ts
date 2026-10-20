import { catalog } from "@/lib/discovery";
export const revalidate = 300;
export async function GET() {
  return Response.json(await catalog(), { headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=300" } });
}
