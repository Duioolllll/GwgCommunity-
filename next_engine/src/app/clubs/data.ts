/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { clubs, clubPosts, clubRecruitments } from "@/lib/db/schema";

// 공개 동아리 최대 100개에 현재 모집 기간에 속하는 공고 존재 여부를 붙인다.
// 기능 `listClubs`(): `getDb().select({ id: clubs.id, slug: clubs.slug, name: clubs.name, category: clubs.category, introduction: clubs.introduction, recruiting: sql<boolean>`exists (select 1 from club_recruitments r where r.club_id = ${clubs.id} and r.is_open and r.opens_at <= now() and r.closes_at > now())` }) .from(clubs).where(eq(clubs.isPublic, true)).orderBy(asc(clubs.name)).limit(100)`를 반환한다.
export async function listClubs() {
  return getDb().select({ id: clubs.id, slug: clubs.slug, name: clubs.name, category: clubs.category, introduction: clubs.introduction,
    recruiting: sql<boolean>`exists (select 1 from club_recruitments r where r.club_id = ${clubs.id} and r.is_open and r.opens_at <= now() and r.closes_at > now())` })
    .from(clubs).where(eq(clubs.isPublic, true)).orderBy(asc(clubs.name)).limit(100);
}

// 비공개 동아리 포함 여부는 호출자가 결정하지만 소식은 공개된 것만 가져온다.
// 기능 `getPublicClub`(slug, includePrivate): 먼저 `const [club] = await getDb().select({ id: clubs.id, slug: clubs.slug, name: clubs.name, category: clubs.category, introduction: clubs.introduction, isPublic: clubs.isPublic }).from(clubs).where(and(eq(clubs.slug, slug), includePrivate ? undefined : eq(clubs.isPublic, true)));`를 실행한다.
export async function getPublicClub(slug: string, includePrivate = false) {
  // 선택 조건 `includePrivate`: 참이면 `undefined`, 거짓이면 `eq(clubs.isPublic, true)`를 사용한다.
  const [club] = await getDb().select({ id: clubs.id, slug: clubs.slug, name: clubs.name, category: clubs.category, introduction: clubs.introduction, isPublic: clubs.isPublic }).from(clubs).where(and(eq(clubs.slug, slug), includePrivate ? undefined : eq(clubs.isPublic, true)));
  // 조건 `!club`: 참이면 `null`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!club) return null;
  const [posts, recruitments] = await Promise.all([
    getDb().select({ id: clubPosts.id, title: clubPosts.title, content: clubPosts.content, createdAt: clubPosts.createdAt }).from(clubPosts).where(and(eq(clubPosts.clubId, club.id), eq(clubPosts.isPublic, true))).orderBy(asc(clubPosts.createdAt)).limit(100),
    getDb().select({ id: clubRecruitments.id, title: clubRecruitments.title, description: clubRecruitments.description, opensAt: clubRecruitments.opensAt, closesAt: clubRecruitments.closesAt, isOpen: clubRecruitments.isOpen }).from(clubRecruitments).where(eq(clubRecruitments.clubId, club.id)).orderBy(asc(clubRecruitments.opensAt)).limit(100),
  ]);
  return { ...club, posts, recruitments };
}
