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

export type MarketFilters = { q?: string; category?: string; status?: string; minPrice?: string; maxPrice?: string; page?: string };
export function parseFilters(input: MarketFilters) {
  const q = (input.q ?? "").trim().slice(0, 100);
  const category = categories.find((value) => value === input.category) ?? "";
  const status = (["AVAILABLE", "RESERVED", "COMPLETED"] as const).find((value) => value === input.status) ?? "";
  const validPrice = (value?: string) => value && /^\d{1,9}$/.test(value) ? Math.min(Number(value), 100000000) : undefined;
  const page = input.page && /^\d{1,5}$/.test(input.page) ? Math.max(1, Math.min(Number(input.page), 10000)) : 1;
  return { q, category, status, minPrice: validPrice(input.minPrice), maxPrice: validPrice(input.maxPrice), page };
}

export async function listMarketPosts(db: Database, input: MarketFilters) {
  const filters = parseFilters(input);
  const conditions: SQL[] = [];
  if (filters.q) conditions.push(ilike(marketPosts.title, `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`));
  if (filters.category) conditions.push(eq(marketPosts.category, filters.category));
  if (filters.status === "AVAILABLE" || filters.status === "RESERVED" || filters.status === "COMPLETED") conditions.push(eq(marketPosts.status, filters.status));
  if (filters.minPrice !== undefined) conditions.push(gte(marketPosts.price, filters.minPrice));
  if (filters.maxPrice !== undefined) conditions.push(lte(marketPosts.price, filters.maxPrice));
  const posts = await db.select({ id: marketPosts.id, title: marketPosts.title, category: marketPosts.category, price: marketPosts.price, status: marketPosts.status, createdAt: marketPosts.createdAt })
    .from(marketPosts).where(and(...conditions)).orderBy(desc(marketPosts.createdAt), desc(marketPosts.id)).limit(21).offset((filters.page - 1) * 20);
  return { posts: posts.slice(0, 20), hasNext: posts.length > 20, page: filters.page };
}
