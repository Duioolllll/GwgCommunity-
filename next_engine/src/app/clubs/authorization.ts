/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { headers } from "next/headers";
import { and, eq, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { clubMembers, clubs } from "@/lib/db/schema";
import { errorResponse } from "@/lib/api";

// 인증된 학생 여부와 동아리 운영 권한을 확인하며 비공개 동아리는 비운영자에게 숨긴다.
// 기능 `authorizeClub`(slug, requireManager): 먼저 `const viewer = await getCurrentUser(await headers());`를 실행한다.
export async function authorizeClub(slug: string, requireManager = false) {
  const viewer = await getCurrentUser(await headers());
  // 조건 `!viewer`: 참이면 `{ error: errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401) } as const`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!viewer) return { error: errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401) } as const;
  // 조건 `!viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT"`: 참이면 `{ error: errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403) } as const`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!viewer.emailVerified`: 거짓인 경우에만 오른쪽 `viewer.status !== "ACTIVE_STUDENT"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT") return { error: errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403) } as const;
  const [club] = await getDb().select().from(clubs).where(eq(clubs.slug, slug));
  // 조건 `!club`: 참이면 `{ error: errorResponse("NOT_FOUND", "동아리를 찾을 수 없습니다.", 404) } as const`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!club) return { error: errorResponse("NOT_FOUND", "동아리를 찾을 수 없습니다.", 404) } as const;
  const [membership] = await getDb().select({ role: clubMembers.role }).from(clubMembers).where(and(eq(clubMembers.clubId, club.id), eq(clubMembers.userId, viewer.id), inArray(clubMembers.role, ["owner", "manager"])));
  // 단락 분기 `viewer.role === "admin"`: 거짓인 경우에만 오른쪽 `Boolean(membership)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  const manager = viewer.role === "admin" || Boolean(membership);
  // 조건 `!club.isPublic && !manager`: 참이면 `{ error: errorResponse("NOT_FOUND", "동아리를 찾을 수 없습니다.", 404) } as const`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!club.isPublic`: 참인 경우에만 오른쪽 `!manager`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!club.isPublic && !manager) return { error: errorResponse("NOT_FOUND", "동아리를 찾을 수 없습니다.", 404) } as const;
  // 조건 `requireManager && !manager`: 참이면 `{ error: errorResponse("FORBIDDEN", "동아리 운영자 권한이 필요합니다.", 403) } as const`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `requireManager`: 참인 경우에만 오른쪽 `!manager`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (requireManager && !manager) return { error: errorResponse("FORBIDDEN", "동아리 운영자 권한이 필요합니다.", 403) } as const;
  return { viewer, club, manager } as const;
}
