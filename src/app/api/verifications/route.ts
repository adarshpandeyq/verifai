import { db } from "@/db";
import { verifications } from "@/db/schema";
import { desc } from "drizzle-orm";
import { serializeVerification } from "@/lib/pipeline/run";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(verifications).orderBy(desc(verifications.createdAt)).limit(50);
    return Response.json({ items: rows.map(serializeVerification) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load history.";
    return Response.json({ items: [], error: message }, { status: 500 });
  }
}
