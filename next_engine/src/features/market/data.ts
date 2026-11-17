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
// 중고거래 검색 조건이 올바른지 확인한다.
export function parseFilters(raw: MarketFilters) {
  // 같은 검색 항목이 여러 번 왔을 때 첫 번째 값만 사용한다.
  // 선택 기준: 입력값이 목록임 있음 또는 true. 맞으면 입력값에서 0에 해당하는 값을 사용하고, 아니면 입력값을 사용한다.
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const input = { q: first(raw.q), category: first(raw.category), status: first(raw.status), minPrice: first(raw.minPrice), maxPrice: first(raw.maxPrice), page: first(raw.page) };
  // 입력 내용의 검색어이 비어 있으면 빈 글자를 대신 사용한다.
  const q = (input.q ?? "").trim().slice(0, 100);
  // 두 글에 분류 정보가 있고 서로 같으면 40점, 그 외에는 0점이다.
  const category = categories.find((value) => value === input.category) ?? "";
  // find 처리 결과이 비어 있으면 빈 글자를 대신 사용한다.
  // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
  const status = (["AVAILABLE", "RESERVED", "COMPLETED"] as const).find((value) => value === input.status) ?? "";
  // 가격이 허용한 범위의 정수인지 확인한다.
  // 선택 기준: (입력값 있음 또는 true) 그리고 (입력값의 형식이 맞음 있음 또는 true). 맞으면 최솟값 처리 결과를 사용하고, 아니면 undefined를 사용한다.
  const validPrice = (value?: string) => value && /^\d{1,9}$/.test(value) ? Math.min(Number(value), 100000000) : undefined;
  // 선택 기준: (입력 내용의 페이지 번호 있음 또는 true) 그리고 (입력 내용의 페이지 번호의 형식이 맞음 있음 또는 true). 맞으면 최댓값 처리 결과를 사용하고, 아니면 1를 사용한다.
  const page = input.page && /^\d{1,5}$/.test(input.page) ? Math.max(1, Math.min(Number(input.page), 10000)) : 1;
  return { q, category, status, minPrice: validPrice(input.minPrice), maxPrice: validPrice(input.maxPrice), page };
}

// 거래 글을 조건별로 불러오고 한 건을 더 가져와 다음 페이지 여부를 판별한다.
// 검색·분류·가격·상태 조건에 맞는 중고거래 글을 불러온다.
export async function listMarketPosts(db: Database, input: MarketFilters) {
  const filters = parseFilters(input);
  const conditions: SQL[] = [];
  // 확인할 조건: 검색 조건의 검색어 있음 또는 true. 해당하면 아래에 있는 작업을 실행한다.
  if (filters.q) conditions.push(ilike(marketPosts.title, `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`));
  // 확인할 조건: 검색 조건의 분류 있음 또는 true. 해당하면 아래에 있는 작업을 실행한다.
  if (filters.category) conditions.push(eq(marketPosts.category, filters.category));
  // 확인할 조건: ((검색 조건의 상태 = “판매 중”) 또는 (검색 조건의 상태 = “예약 중”)) 또는 (검색 조건의 상태 = “완료”). 해당하면 아래에 있는 작업을 실행한다.
  if (filters.status === "AVAILABLE" || filters.status === "RESERVED" || filters.status === "COMPLETED") conditions.push(eq(marketPosts.status, filters.status));
  // 확인할 조건: 검색 조건의 minPrice ≠ undefined. 해당하면 아래에 있는 작업을 실행한다.
  if (filters.minPrice !== undefined) conditions.push(gte(marketPosts.price, filters.minPrice));
  // 확인할 조건: 검색 조건의 maxPrice ≠ undefined. 해당하면 아래에 있는 작업을 실행한다.
  if (filters.maxPrice !== undefined) conditions.push(lte(marketPosts.price, filters.maxPrice));
  const posts = await db.select({ id: marketPosts.id, title: marketPosts.title, category: marketPosts.category, price: marketPosts.price, status: marketPosts.status, createdAt: marketPosts.createdAt })
    .from(marketPosts).where(and(...conditions)).orderBy(desc(marketPosts.createdAt), desc(marketPosts.id)).limit(21).offset((filters.page - 1) * 20);
  return { posts: posts.slice(0, 20), hasNext: posts.length > 20, page: filters.page };
}
