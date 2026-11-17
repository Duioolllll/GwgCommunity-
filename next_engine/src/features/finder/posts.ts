import { and, desc, eq, or, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/types";
import { finderPosts } from "@/lib/db/schema";

export type FinderInput = { kind: "lost" | "found"; title: string; category: string; color: string; generalLocation: string; occurredAt: string };

// 분실·습득 유형과 필수 문자열, 실제 달력 날짜를 검증한다.
// 분실·습득물 등록 내용을 검사해 저장할 형태로 정리한다.
export function parseFinderInput(body: Record<string, unknown> | null): FinderInput | null {
  // 확인할 조건: (요청 내용 없음 또는 false) 또는 ((요청 내용의 분실·습득 종류 ≠ “분실”) 그리고 (요청 내용의 분실·습득 종류 ≠ “습득”)). 해당하면 사용할 수 있는 값이 없다고 알린다.
  if (!body || (body.kind !== "lost" && body.kind !== "found")) return null;
  // 입력 항목이 글자인지 확인하고 앞뒤 공백과 길이를 정리한다.
  const field = (name: string, max: number) => {
    const value = body[name];
    // 입력값의 자료형이 이 코드에서 요구하는 형식인지 확인한다. 맞지 않는 값은 아래 처리에서 제외한다.
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    // 선택 기준: (trimmed의 개수 또는 길이 > 0) 그리고 (trimmed의 개수 또는 길이 ≤ 최댓값). 맞으면 trimmed를 사용하고, 아니면 값 없음을 사용한다.
    return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
  };
  const title = field("title", 120), category = field("category", 50), color = field("color", 50), generalLocation = field("generalLocation", 120);
  const occurredAt = field("occurredAt", 10);
  // 확인할 조건: (((((제목 없음 또는 false) 또는 (분류 없음 또는 false)) 또는 (색상 없음 또는 false)) 또는 (대략적인 장소 없음 또는 false)) 또는 (발생 날짜 없음 또는 false)) 또는 (발생 날짜의 형식이 맞음 조건을 만족하지 않음). 해당하면 사용할 수 있는 값이 없다고 알린다.
  if (!title || !category || !color || !generalLocation || !occurredAt || !/^\d{4}-\d{2}-\d{2}$/.test(occurredAt)) return null;
  // 같은 날은 15점, 3일 이내는 10점, 7일 이내는 5점, 그보다 멀면 0점이다.
  const date = new Date(`${occurredAt}T00:00:00Z`);
  // 확인할 조건: (date를 숫자로 바꾼 값이 정상적인 숫자임 조건을 만족하지 않음) 또는 (slice 처리 결과 ≠ 발생 날짜). 해당하면 사용할 수 있는 값이 없다고 알린다.
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== occurredAt) return null;
  return { kind: body.kind, title, category, color, generalLocation, occurredAt };
}

export type FinderFilters = { page: number; kind?: "lost" | "found"; category?: string; color?: string; q?: string };

// 검색 조건의 길이와 페이지 및 유형 범위를 검증한다.
// 분실물 검색 조건이 허용된 값인지 확인한다.
export function parseFinderFilters(params: URLSearchParams): FinderFilters | null {
  // 주소에 담긴 값에서 찾은 “page”이 비어 있으면 “1” 값을 대신 사용한다.
  const pageText = params.get("page") ?? "1";
  const page = Number(pageText);
  // 주소에 담긴 값에서 찾은 “kind”이 없거나 조건에 맞지 않을 때 undefined을 대신 사용한다.
  const kind = params.get("kind") || undefined;
  // 두 글에 분류 정보가 있고 서로 같으면 40점, 그 외에는 0점이다.
  const category = params.get("category")?.trim() || undefined;
  // 두 글에 색상 정보가 있고 서로 같으면 25점, 그 외에는 0점이다.
  const color = params.get("color")?.trim() || undefined;
  // 표기를 통일한 주소에 담긴 값에서 찾은 “q”이 없거나 조건에 맞지 않을 때 undefined을 대신 사용한다.
  const q = params.get("q")?.trim() || undefined;
  // 확인할 조건: (((((((pageText의 형식이 맞음 조건을 만족하지 않음) 또는 (페이지 번호이 정수임 조건을 만족하지 않음)) 또는 (페이지 번호 < 1)) 또는 (페이지 번호 > 10000)) 또는 (((분실·습득 종류 있음 또는 true) 그리고 (분실·습득 종류 ≠ “분실”)) 그리고 (분실·습득 종류 ≠ “습득”))) 또는 ((분류 있음 또는 true) 그리고 (분류의 개수 또는 길이 > 50))) 또는 ((색상 있음 또는 true) 그리고 (색상의 개수 또는 길이 > 50))) 또는 ((검색어 있음 또는 true) 그리고 (검색어의 개수 또는 길이 > 120)). 해당하면 사용할 수 있는 값이 없다고 알린다.
  if (!/^\d+$/.test(pageText) || !Number.isInteger(page) || page < 1 || page > 10000 || (kind && kind !== "lost" && kind !== "found") || (category && category.length > 50) || (color && color.length > 50) || (q && q.length > 120)) return null;
  return { page, kind: kind as FinderFilters["kind"], category, color, q };
}

// 다른 사람에게는 승인된 글만 보여준다. 인증된 학생은 자신의 심사 대기 글도 볼 수 있다.
// 승인된 활성 글과 보는 사람 본인 글을 필터링해 21건까지 불러온다.
// 보는 사람의 권한과 검색 조건에 맞는 분실물 글을 불러온다.
export function listFinderPosts(db: Database, viewerId?: string, page = 1, kind?: "lost" | "found", filters: Pick<FinderFilters, "category" | "color" | "q"> = {}) {
  // 로그인하지 않은 사람에게는 승인된 글만 보여준다. 로그인한 사람은 자신의 심사 대기 글도 볼 수 있게 한다.
  const visibility = viewerId ? or(eq(finderPosts.publicApproval, "APPROVED"), eq(finderPosts.ownerId, viewerId)) : eq(finderPosts.publicApproval, "APPROVED");
  // 검색어의 특수문자를 검색 명령으로 해석하지 않고 입력한 글자 그대로 찾는다.
  // 검색어의 특수문자를 보호하고 일부 내용이 포함된 글을 찾을 검색값을 만든다.
  const contains = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;
  // 진행 중인 글에서 공개 권한과 분실·습득 종류, 분류, 색상, 제목 검색 조건을 적용한다. 최신 글부터 21개를 읽어 다음 페이지가 있는지도 확인한다.
  return db.select({ id: finderPosts.id, kind: finderPosts.kind, title: finderPosts.title, category: finderPosts.category, color: finderPosts.color, generalLocation: finderPosts.generalLocation, occurredAt: finderPosts.occurredAt, status: finderPosts.status, createdAt: finderPosts.createdAt, isOwn: viewerId ? sql<boolean>`${finderPosts.ownerId} = ${viewerId}` : sql<boolean>`false` })
    .from(finderPosts).where(and(visibility, eq(finderPosts.status, "ACTIVE"), kind ? eq(finderPosts.kind, kind) : undefined,
      filters.category ? sql`${finderPosts.category} ILIKE ${contains(filters.category)}` : undefined,
      filters.color ? sql`${finderPosts.color} ILIKE ${contains(filters.color)}` : undefined,
      filters.q ? sql`${finderPosts.title} ILIKE ${contains(filters.q)}` : undefined))
    .orderBy(desc(finderPosts.createdAt), desc(finderPosts.id)).limit(21).offset((page - 1) * 20);
}
