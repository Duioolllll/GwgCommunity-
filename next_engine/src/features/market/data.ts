/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { and, desc, eq, ilike, lte, gte, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db/types";
import { marketPosts } from "@/lib/db/schema";

export const categories = ["책·교재", "의류", "전자기기", "나눔", "기타"] as const;
export const marketInput = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(5000),
  category: z.enum(categories),
  price: z.number().int().min(0).max(100000000),
}).strict();
export const marketId = z.string().uuid();
export const marketStatusLabels = { AVAILABLE: "판매 중", RESERVED: "예약 중", COMPLETED: "거래 완료" } as const;

export type MarketFilters = { q?: string | string[]; category?: string | string[]; status?: string | string[]; minPrice?: string | string[]; maxPrice?: string | string[]; page?: string | string[] };
// 검색어, 카테고리, 가격과 페이지 입력을 정규화하고 범위를 제한한다.
// 기능 `parseFilters`(raw): 먼저 `const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;`를 실행한다.
export function parseFilters(raw: MarketFilters) {
  // 기능 `first`(value): `Array.isArray(value) ? value[0] : value` 평가 결과를 반환한다.
  // 선택 조건 `Array.isArray(value)`: 참이면 `value[0]`, 거짓이면 `value`를 사용한다.
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const input = { q: first(raw.q), category: first(raw.category), status: first(raw.status), minPrice: first(raw.minPrice), maxPrice: first(raw.maxPrice), page: first(raw.page) };
  // 단락 분기 `input.q`: null 또는 undefined인 경우에만 오른쪽 `""`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  const q = (input.q ?? "").trim().slice(0, 100);
  // 단락 분기 `categories.find((value) => value === input.category)`: null 또는 undefined인 경우에만 오른쪽 `""`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 기능 `콜백`(value): `value === input.category` 평가 결과를 반환한다.
  const category = categories.find((value) => value === input.category) ?? "";
  // 단락 분기 `(["AVAILABLE", "RESERVED", "COMPLETED"] as const).find((value) => value === input.status)`: null 또는 undefined인 경우에만 오른쪽 `""`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 기능 `콜백`(value): `value === input.status` 평가 결과를 반환한다.
  const status = (["AVAILABLE", "RESERVED", "COMPLETED"] as const).find((value) => value === input.status) ?? "";
  // 기능 `validPrice`(value): `value && /^\d{1,9}$/.test(value) ? Math.min(Number(value), 100000000) : undefined` 평가 결과를 반환한다.
  // 선택 조건 `value && /^\d{1,9}$/.test(value)`: 참이면 `Math.min(Number(value), 100000000)`, 거짓이면 `undefined`를 사용한다.
  // 단락 분기 `value`: 참인 경우에만 오른쪽 `/^\d{1,9}$/.test(value)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  const validPrice = (value?: string) => value && /^\d{1,9}$/.test(value) ? Math.min(Number(value), 100000000) : undefined;
  // 선택 조건 `input.page && /^\d{1,5}$/.test(input.page)`: 참이면 `Math.max(1, Math.min(Number(input.page), 10000))`, 거짓이면 `1`를 사용한다.
  // 단락 분기 `input.page`: 참인 경우에만 오른쪽 `/^\d{1,5}$/.test(input.page)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  const page = input.page && /^\d{1,5}$/.test(input.page) ? Math.max(1, Math.min(Number(input.page), 10000)) : 1;
  return { q, category, status, minPrice: validPrice(input.minPrice), maxPrice: validPrice(input.maxPrice), page };
}

// 거래 글을 조건별로 조회하고 한 건을 더 가져와 다음 페이지 여부를 판별한다.
// 기능 `listMarketPosts`(db, input): 먼저 `const filters = parseFilters(input);`를 실행한다.
export async function listMarketPosts(db: Database, input: MarketFilters) {
  const filters = parseFilters(input);
  const conditions: SQL[] = [];
  // 조건 `filters.q`: 참이면 먼저 `conditions.push(ilike(marketPosts.title, `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`));`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (filters.q) conditions.push(ilike(marketPosts.title, `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`));
  // 조건 `filters.category`: 참이면 먼저 `conditions.push(eq(marketPosts.category, filters.category));`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (filters.category) conditions.push(eq(marketPosts.category, filters.category));
  // 조건 `filters.status === "AVAILABLE" || filters.status === "RESERVED" || filters.status === "COMPLETED"`: 참이면 먼저 `conditions.push(eq(marketPosts.status, filters.status));`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `filters.status === "AVAILABLE" || filters.status === "RESERVED"`: 거짓인 경우에만 오른쪽 `filters.status === "COMPLETED"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `filters.status === "AVAILABLE"`: 거짓인 경우에만 오른쪽 `filters.status === "RESERVED"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (filters.status === "AVAILABLE" || filters.status === "RESERVED" || filters.status === "COMPLETED") conditions.push(eq(marketPosts.status, filters.status));
  // 조건 `filters.minPrice !== undefined`: 참이면 먼저 `conditions.push(gte(marketPosts.price, filters.minPrice));`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (filters.minPrice !== undefined) conditions.push(gte(marketPosts.price, filters.minPrice));
  // 조건 `filters.maxPrice !== undefined`: 참이면 먼저 `conditions.push(lte(marketPosts.price, filters.maxPrice));`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (filters.maxPrice !== undefined) conditions.push(lte(marketPosts.price, filters.maxPrice));
  const posts = await db.select({ id: marketPosts.id, title: marketPosts.title, category: marketPosts.category, price: marketPosts.price, status: marketPosts.status, createdAt: marketPosts.createdAt })
    .from(marketPosts).where(and(...conditions)).orderBy(desc(marketPosts.createdAt), desc(marketPosts.id)).limit(21).offset((filters.page - 1) * 20);
  return { posts: posts.slice(0, 20), hasNext: posts.length > 20, page: filters.page };
}
