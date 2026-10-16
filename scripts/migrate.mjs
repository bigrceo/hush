// Applies migrations/pg/*.sql to DATABASE_URL (idempotent). usage: node --env-file=.env.local scripts/migrate.mjs
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing");
const sql = neon(url);
const dir = new URL("../migrations/pg/", import.meta.url);
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  for (const stmt of fs.readFileSync(new URL(f, dir), "utf8").split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) await sql.query(stmt);
  console.log("applied", f);
}
