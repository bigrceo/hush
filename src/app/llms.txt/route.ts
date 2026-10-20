import { llmsTxt } from "@/lib/discovery";
export const revalidate = 300;
export async function GET() {
  return new Response(await llmsTxt(), { headers: { "content-type": "text/plain; charset=utf-8", "access-control-allow-origin": "*", "cache-control": "public, max-age=300" } });
}
