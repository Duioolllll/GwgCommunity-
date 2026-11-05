import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { invitations } from "@/lib/db/schema";
import { errorResponse } from "@/lib/api";
import { issueInvitation } from "@/features/invitations/service";
import { hasTrustedOrigin } from "@/lib/auth/origin";

async function admin() {
  const user = await getCurrentUser(await headers());
  return user?.emailVerified && user.status === "ACTIVE_STUDENT" && user.role === "admin" ? user : null;
}

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403);
  const user = await admin();
  if (!user) return errorResponse("FORBIDDEN", "관리자 권한이 필요합니다.", 403);
  const secret = process.env.INVITATION_SECRET;
  if (!secret) throw new Error("INVITATION_SECRET is required");
  const invitation = await issueInvitation(getDb(), user.id, secret);
  return NextResponse.json(invitation, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  if (!await admin()) return errorResponse("FORBIDDEN", "관리자 권한이 필요합니다.", 403);
  const rows = await getDb().select({ id: invitations.id, issuedBy: invitations.issuedBy, createdAt: invitations.createdAt, expiresAt: invitations.expiresAt, redeemedAt: invitations.redeemedAt, revokedAt: invitations.revokedAt }).from(invitations).orderBy(desc(invitations.createdAt)).limit(100);
  return NextResponse.json({ invitations: rows }, { headers: { "Cache-Control": "no-store" } });
}
