import { db } from "@/db";
import { verifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { serializeVerification } from "@/lib/pipeline/run";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  const rows = await db.select().from(verifications).where(eq(verifications.id, numericId)).limit(1);
  if (!rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ item: serializeVerification(rows[0]) });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  await db.delete(verifications).where(eq(verifications.id, numericId));
  return Response.json({ ok: true });
}
