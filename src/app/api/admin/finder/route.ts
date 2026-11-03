import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { actor, failure } from "@/features/moderation/http";
import { listPendingFinder } from "@/features/moderation/service";
export async function GET() {
  const { viewer, error: authError } = await actor(true);
  if (authError) return authError;
  try { return NextResponse.json({ posts: await listPendingFinder(getDb(), viewer.id) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error); }
}
