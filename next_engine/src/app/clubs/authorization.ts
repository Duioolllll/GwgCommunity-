import { headers } from "next/headers";
import { and, eq, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { clubMembers, clubs } from "@/lib/db/schema";
import { errorResponse } from "@/lib/api";

// 인증된 학생 여부와 동아리 운영 권한을 확인하며 비공개 동아리는 비운영자에게 숨긴다.
// 동아리가 공개되어 있는지와 사용자가 관리할 수 있는지 확인한다.
export async function authorizeClub(slug: string, requireManager = false) {
  const viewer = await getCurrentUser(await headers());
  // 확인할 조건: viewer 없음 또는 false. 해당하면 필요한 항목을 묶은 자료를 돌려준다.
  if (!viewer) return { error: errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401) } as const;
  // 확인할 조건: (viewer의 이메일 인증 여부 없음 또는 false) 또는 (viewer의 상태 ≠ “인증된 학생”). 해당하면 필요한 항목을 묶은 자료를 돌려준다.
  if (!viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT") return { error: errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403) } as const;
  const [club] = await getDb().select().from(clubs).where(eq(clubs.slug, slug));
  // 확인할 조건: 동아리 없음 또는 false. 해당하면 필요한 항목을 묶은 자료를 돌려준다.
  if (!club) return { error: errorResponse("NOT_FOUND", "동아리를 찾을 수 없습니다.", 404) } as const;
  const [membership] = await getDb().select({ role: clubMembers.role }).from(clubMembers).where(and(eq(clubMembers.clubId, club.id), eq(clubMembers.userId, viewer.id), inArray(clubMembers.role, ["owner", "manager"])));
  const manager = viewer.role === "admin" || Boolean(membership);
  // 확인할 조건: (동아리의 공개 여부 없음 또는 false) 그리고 (운영자 여부 없음 또는 false). 해당하면 필요한 항목을 묶은 자료를 돌려준다.
  if (!club.isPublic && !manager) return { error: errorResponse("NOT_FOUND", "동아리를 찾을 수 없습니다.", 404) } as const;
  // 확인할 조건: (운영자 권한 필요 여부 있음 또는 true) 그리고 (운영자 여부 없음 또는 false). 해당하면 필요한 항목을 묶은 자료를 돌려준다.
  if (requireManager && !manager) return { error: errorResponse("FORBIDDEN", "동아리 운영자 권한이 필요합니다.", 403) } as const;
  return { viewer, club, manager } as const;
}
