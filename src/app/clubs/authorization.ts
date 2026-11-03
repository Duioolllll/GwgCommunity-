import { headers } from "next/headers";
import { and, eq, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { clubMembers, clubs } from "@/lib/db/schema";
import { errorResponse } from "@/lib/api";

export async function authorizeClub(slug: string, requireManager = false) {
  const viewer = await getCurrentUser(await headers());
  if (!viewer) return { error: errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401) } as const;
  if (!viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT") return { error: errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403) } as const;
  const [club] = await getDb().select().from(clubs).where(eq(clubs.slug, slug));
  if (!club) return { error: errorResponse("NOT_FOUND", "동아리를 찾을 수 없습니다.", 404) } as const;
  const [membership] = await getDb().select({ role: clubMembers.role }).from(clubMembers).where(and(eq(clubMembers.clubId, club.id), eq(clubMembers.userId, viewer.id), inArray(clubMembers.role, ["owner", "manager"])));
  const manager = viewer.role === "admin" || Boolean(membership);
  if (!club.isPublic && !manager) return { error: errorResponse("NOT_FOUND", "동아리를 찾을 수 없습니다.", 404) } as const;
  if (requireManager && !manager) return { error: errorResponse("FORBIDDEN", "동아리 운영자 권한이 필요합니다.", 403) } as const;
  return { viewer, club, manager } as const;
}
