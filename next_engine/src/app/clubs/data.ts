import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { clubs, clubPosts, clubRecruitments } from "@/lib/db/schema";

// 공개 동아리 최대 100개에 현재 모집 기간에 속하는 공고 존재 여부를 붙인다.
// 공개된 동아리 목록을 불러온다.
export async function listClubs() {
  return getDb().select({ id: clubs.id, slug: clubs.slug, name: clubs.name, category: clubs.category, introduction: clubs.introduction,
    recruiting: sql<boolean>`exists (select 1 from club_recruitments r where r.club_id = ${clubs.id} and r.is_open and r.opens_at <= now() and r.closes_at > now())` })
    .from(clubs).where(eq(clubs.isPublic, true)).orderBy(asc(clubs.name)).limit(100);
}

// 비공개 동아리 포함 여부는 호출자가 결정하지만 소식은 공개된 것만 가져온다.
// 동아리 소개와 공개 활동을 불러오고 권한이 있으면 비공개 내용도 포함한다.
export async function getPublicClub(slug: string, includePrivate = false) {
  // 선택 기준: 비공개 글 포함 여부 있음 또는 true. 맞으면 undefined를 사용하고, 아니면 eq 처리 결과를 사용한다.
  const [club] = await getDb().select({ id: clubs.id, slug: clubs.slug, name: clubs.name, category: clubs.category, introduction: clubs.introduction, isPublic: clubs.isPublic }).from(clubs).where(and(eq(clubs.slug, slug), includePrivate ? undefined : eq(clubs.isPublic, true)));
  // 확인할 조건: 동아리 없음 또는 false. 해당하면 사용할 수 있는 값이 없다고 알린다.
  if (!club) return null;
  const [posts, recruitments] = await Promise.all([
    getDb().select({ id: clubPosts.id, title: clubPosts.title, content: clubPosts.content, createdAt: clubPosts.createdAt }).from(clubPosts).where(and(eq(clubPosts.clubId, club.id), eq(clubPosts.isPublic, true))).orderBy(asc(clubPosts.createdAt)).limit(100),
    getDb().select({ id: clubRecruitments.id, title: clubRecruitments.title, description: clubRecruitments.description, opensAt: clubRecruitments.opensAt, closesAt: clubRecruitments.closesAt, isOpen: clubRecruitments.isOpen }).from(clubRecruitments).where(eq(clubRecruitments.clubId, club.id)).orderBy(asc(clubRecruitments.opensAt)).limit(100),
  ]);
  return { ...club, posts, recruitments };
}
