/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { and, desc, eq, or, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/types";
import { finderPosts } from "@/lib/db/schema";

export type FinderInput = { kind: "lost" | "found"; title: string; category: string; color: string; generalLocation: string; occurredAt: string };

// 분실·습득 유형과 필수 문자열, 실제 달력 날짜를 검증한다.
// 기능 `parseFinderInput`(body): `!body || (body.kind !== "lost" && body.kind !== "found")` 조건을 추가로 검사한다.
export function parseFinderInput(body: Record<string, unknown> | null): FinderInput | null {
  // 조건 `!body || (body.kind !== "lost" && body.kind !== "found")`: 참이면 `null`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!body`: 거짓인 경우에만 오른쪽 `(body.kind !== "lost" && body.kind !== "found")`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `body.kind !== "lost"`: 참인 경우에만 오른쪽 `body.kind !== "found"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!body || (body.kind !== "lost" && body.kind !== "found")) return null;
  // 기능 `field`(name, max): 먼저 `const value = body[name];`를 실행한다.
  const field = (name: string, max: number) => {
    const value = body[name];
    // 조건 `typeof value !== "string"`: 참이면 `null`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    // 선택 조건 `trimmed.length > 0 && trimmed.length <= max`: 참이면 `trimmed`, 거짓이면 `null`를 사용한다.
    // 단락 분기 `trimmed.length > 0`: 참인 경우에만 오른쪽 `trimmed.length <= max`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
  };
  const title = field("title", 120), category = field("category", 50), color = field("color", 50), generalLocation = field("generalLocation", 120);
  const occurredAt = field("occurredAt", 10);
  // 조건 `!title || !category || !color || !generalLocation || !occurredAt || !/^\d{4}-\d{2}-\d{2}$/.test(occurredAt)`: 참이면 `null`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!title || !category || !color || !generalLocation || !occurredAt`: 거짓인 경우에만 오른쪽 `!/^\d{4}-\d{2}-\d{2}$/.test(occurredAt)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!title || !category || !color || !generalLocation`: 거짓인 경우에만 오른쪽 `!occurredAt`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!title || !category || !color`: 거짓인 경우에만 오른쪽 `!generalLocation`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!title || !category`: 거짓인 경우에만 오른쪽 `!color`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!title`: 거짓인 경우에만 오른쪽 `!category`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!title || !category || !color || !generalLocation || !occurredAt || !/^\d{4}-\d{2}-\d{2}$/.test(occurredAt)) return null;
  const date = new Date(`${occurredAt}T00:00:00Z`);
  // 조건 `!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== occurredAt`: 참이면 `null`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!Number.isFinite(date.getTime())`: 거짓인 경우에만 오른쪽 `date.toISOString().slice(0, 10) !== occurredAt`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== occurredAt) return null;
  return { kind: body.kind, title, category, color, generalLocation, occurredAt };
}

export type FinderFilters = { page: number; kind?: "lost" | "found"; category?: string; color?: string; q?: string };

// 검색 조건의 길이와 페이지 및 유형 범위를 검증한다.
// 기능 `parseFinderFilters`(params): 먼저 `const pageText = params.get("page") ?? "1";`를 실행한다.
export function parseFinderFilters(params: URLSearchParams): FinderFilters | null {
  // 단락 분기 `params.get("page")`: null 또는 undefined인 경우에만 오른쪽 `"1"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  const pageText = params.get("page") ?? "1";
  const page = Number(pageText);
  // 단락 분기 `params.get("kind")`: 거짓인 경우에만 오른쪽 `undefined`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  const kind = params.get("kind") || undefined;
  // 단락 분기 `params.get("category")?.trim()`: 거짓인 경우에만 오른쪽 `undefined`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  const category = params.get("category")?.trim() || undefined;
  // 단락 분기 `params.get("color")?.trim()`: 거짓인 경우에만 오른쪽 `undefined`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  const color = params.get("color")?.trim() || undefined;
  // 단락 분기 `params.get("q")?.trim()`: 거짓인 경우에만 오른쪽 `undefined`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  const q = params.get("q")?.trim() || undefined;
  // 조건 `!/^\d+$/.test(pageText) || !Number.isInteger(page) || page < 1 || page > 10000 || (kind && kind !== "lost" && kind !== "found") || (category && category.length > 50) || (color && color.length > 50) || (q && q.length > 120)`: 참이면 `null`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!/^\d+$/.test(pageText) || !Number.isInteger(page) || page < 1 || page > 10000 || (kind && kind !== "lost" && kind !== "found") || (category && category.length > 50) || (color && color.length > 50)`: 거짓인 경우에만 오른쪽 `(q && q.length > 120)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!/^\d+$/.test(pageText) || !Number.isInteger(page) || page < 1 || page > 10000 || (kind && kind !== "lost" && kind !== "found") || (category && category.length > 50)`: 거짓인 경우에만 오른쪽 `(color && color.length > 50)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!/^\d+$/.test(pageText) || !Number.isInteger(page) || page < 1 || page > 10000 || (kind && kind !== "lost" && kind !== "found")`: 거짓인 경우에만 오른쪽 `(category && category.length > 50)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!/^\d+$/.test(pageText) || !Number.isInteger(page) || page < 1 || page > 10000`: 거짓인 경우에만 오른쪽 `(kind && kind !== "lost" && kind !== "found")`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!/^\d+$/.test(pageText) || !Number.isInteger(page) || page < 1`: 거짓인 경우에만 오른쪽 `page > 10000`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!/^\d+$/.test(pageText) || !Number.isInteger(page)`: 거짓인 경우에만 오른쪽 `page < 1`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!/^\d+$/.test(pageText)`: 거짓인 경우에만 오른쪽 `!Number.isInteger(page)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `kind && kind !== "lost"`: 참인 경우에만 오른쪽 `kind !== "found"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `kind`: 참인 경우에만 오른쪽 `kind !== "lost"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `category`: 참인 경우에만 오른쪽 `category.length > 50`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `color`: 참인 경우에만 오른쪽 `color.length > 50`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `q`: 참인 경우에만 오른쪽 `q.length > 120`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!/^\d+$/.test(pageText) || !Number.isInteger(page) || page < 1 || page > 10000 || (kind && kind !== "lost" && kind !== "found") || (category && category.length > 50) || (color && color.length > 50) || (q && q.length > 120)) return null;
  return { page, kind: kind as FinderFilters["kind"], category, color, q };
}

// Public posts must be explicitly approved; active students may also see their own pending posts.
// 승인된 활성 글과 조회자 본인 글을 필터링해 21건까지 조회한다.
// 기능 `listFinderPosts`(db, viewerId, page, kind, filters): 먼저 `const visibility = viewerId ? or(eq(finderPosts.publicApproval, "APPROVED"), eq(finderPosts.ownerId, viewerId)) : eq(finderPosts.publicApproval, "APPROVED");`를 실행한다.
export function listFinderPosts(db: Database, viewerId?: string, page = 1, kind?: "lost" | "found", filters: Pick<FinderFilters, "category" | "color" | "q"> = {}) {
  // 선택 조건 `viewerId`: 참이면 `or(eq(finderPosts.publicApproval, "APPROVED"), eq(finderPosts.ownerId, viewerId))`, 거짓이면 `eq(finderPosts.publicApproval, "APPROVED")`를 사용한다.
  const visibility = viewerId ? or(eq(finderPosts.publicApproval, "APPROVED"), eq(finderPosts.ownerId, viewerId)) : eq(finderPosts.publicApproval, "APPROVED");
  // Treat SQL wildcard characters as literal search text.
  // 기능 `contains`(value): ``%${value.replace(/[\\%_]/g, "\\$&")}%`` 평가 결과를 반환한다.
  const contains = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;
  // 선택 조건 `viewerId`: 참이면 `sql<boolean>`${finderPosts.ownerId} = ${viewerId}``, 거짓이면 `sql<boolean>`false``를 사용한다.
  // 선택 조건 `kind`: 참이면 `eq(finderPosts.kind, kind)`, 거짓이면 `undefined`를 사용한다.
  // 선택 조건 `filters.category`: 참이면 `sql`${finderPosts.category} ILIKE ${contains(filters.category)}``, 거짓이면 `undefined`를 사용한다.
  // 선택 조건 `filters.color`: 참이면 `sql`${finderPosts.color} ILIKE ${contains(filters.color)}``, 거짓이면 `undefined`를 사용한다.
  // 선택 조건 `filters.q`: 참이면 `sql`${finderPosts.title} ILIKE ${contains(filters.q)}``, 거짓이면 `undefined`를 사용한다.
  return db.select({ id: finderPosts.id, kind: finderPosts.kind, title: finderPosts.title, category: finderPosts.category, color: finderPosts.color, generalLocation: finderPosts.generalLocation, occurredAt: finderPosts.occurredAt, status: finderPosts.status, createdAt: finderPosts.createdAt, isOwn: viewerId ? sql<boolean>`${finderPosts.ownerId} = ${viewerId}` : sql<boolean>`false` })
    .from(finderPosts).where(and(visibility, eq(finderPosts.status, "ACTIVE"), kind ? eq(finderPosts.kind, kind) : undefined,
      filters.category ? sql`${finderPosts.category} ILIKE ${contains(filters.category)}` : undefined,
      filters.color ? sql`${finderPosts.color} ILIKE ${contains(filters.color)}` : undefined,
      filters.q ? sql`${finderPosts.title} ILIKE ${contains(filters.q)}` : undefined))
    .orderBy(desc(finderPosts.createdAt), desc(finderPosts.id)).limit(21).offset((page - 1) * 20);
}
