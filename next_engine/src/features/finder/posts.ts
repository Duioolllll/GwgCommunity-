import { and, desc, eq, or, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/types";
import { finderPosts } from "@/lib/db/schema";

export type FinderInput = { kind: "lost" | "found"; title: string; category: string; color: string; generalLocation: string; occurredAt: string };

export function parseFinderInput(body: Record<string, unknown> | null): FinderInput | null {
  if (!body || (body.kind !== "lost" && body.kind !== "found")) return null;
  const field = (name: string, max: number) => {
    const value = body[name];
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
  };
  const title = field("title", 120), category = field("category", 50), color = field("color", 50), generalLocation = field("generalLocation", 120);
  const occurredAt = field("occurredAt", 10);
  if (!title || !category || !color || !generalLocation || !occurredAt || !/^\d{4}-\d{2}-\d{2}$/.test(occurredAt)) return null;
  const date = new Date(`${occurredAt}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== occurredAt) return null;
  return { kind: body.kind, title, category, color, generalLocation, occurredAt };
}

export type FinderFilters = { page: number; kind?: "lost" | "found"; category?: string; color?: string; q?: string };

export function parseFinderFilters(params: URLSearchParams): FinderFilters | null {
  const pageText = params.get("page") ?? "1";
  const page = Number(pageText);
  const kind = params.get("kind") || undefined;
  const category = params.get("category")?.trim() || undefined;
  const color = params.get("color")?.trim() || undefined;
  const q = params.get("q")?.trim() || undefined;
  if (!/^\d+$/.test(pageText) || !Number.isInteger(page) || page < 1 || page > 10000 || (kind && kind !== "lost" && kind !== "found") || (category && category.length > 50) || (color && color.length > 50) || (q && q.length > 120)) return null;
  return { page, kind: kind as FinderFilters["kind"], category, color, q };
}

// Public posts must be explicitly approved; active students may also see their own pending posts.
export function listFinderPosts(db: Database, viewerId?: string, page = 1, kind?: "lost" | "found", filters: Pick<FinderFilters, "category" | "color" | "q"> = {}) {
  const visibility = viewerId ? or(eq(finderPosts.publicApproval, "APPROVED"), eq(finderPosts.ownerId, viewerId)) : eq(finderPosts.publicApproval, "APPROVED");
  // Treat SQL wildcard characters as literal search text.
  const contains = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;
  return db.select({ id: finderPosts.id, kind: finderPosts.kind, title: finderPosts.title, category: finderPosts.category, color: finderPosts.color, generalLocation: finderPosts.generalLocation, occurredAt: finderPosts.occurredAt, status: finderPosts.status, createdAt: finderPosts.createdAt, isOwn: viewerId ? sql<boolean>`${finderPosts.ownerId} = ${viewerId}` : sql<boolean>`false` })
    .from(finderPosts).where(and(visibility, eq(finderPosts.status, "ACTIVE"), kind ? eq(finderPosts.kind, kind) : undefined,
      filters.category ? sql`${finderPosts.category} ILIKE ${contains(filters.category)}` : undefined,
      filters.color ? sql`${finderPosts.color} ILIKE ${contains(filters.color)}` : undefined,
      filters.q ? sql`${finderPosts.title} ILIKE ${contains(filters.q)}` : undefined))
    .orderBy(desc(finderPosts.createdAt), desc(finderPosts.id)).limit(21).offset((page - 1) * 20);
}
