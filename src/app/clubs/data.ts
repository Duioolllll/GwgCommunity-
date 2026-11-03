import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { clubs, clubPosts, clubRecruitments } from "@/lib/db/schema";

export async function listClubs() {
  return getDb().select({ id: clubs.id, slug: clubs.slug, name: clubs.name, category: clubs.category, introduction: clubs.introduction,
    recruiting: sql<boolean>`exists (select 1 from club_recruitments r where r.club_id = ${clubs.id} and r.is_open and r.opens_at <= now() and r.closes_at > now())` })
    .from(clubs).where(eq(clubs.isPublic, true)).orderBy(asc(clubs.name)).limit(100);
}

export async function getPublicClub(slug: string, includePrivate = false) {
  const [club] = await getDb().select({ id: clubs.id, slug: clubs.slug, name: clubs.name, category: clubs.category, introduction: clubs.introduction, isPublic: clubs.isPublic }).from(clubs).where(and(eq(clubs.slug, slug), includePrivate ? undefined : eq(clubs.isPublic, true)));
  if (!club) return null;
  const [posts, recruitments] = await Promise.all([
    getDb().select({ id: clubPosts.id, title: clubPosts.title, content: clubPosts.content, createdAt: clubPosts.createdAt }).from(clubPosts).where(and(eq(clubPosts.clubId, club.id), eq(clubPosts.isPublic, true))).orderBy(asc(clubPosts.createdAt)).limit(100),
    getDb().select({ id: clubRecruitments.id, title: clubRecruitments.title, description: clubRecruitments.description, opensAt: clubRecruitments.opensAt, closesAt: clubRecruitments.closesAt, isOpen: clubRecruitments.isOpen }).from(clubRecruitments).where(eq(clubRecruitments.clubId, club.id)).orderBy(asc(clubRecruitments.opensAt)).limit(100),
  ]);
  return { ...club, posts, recruitments };
}
