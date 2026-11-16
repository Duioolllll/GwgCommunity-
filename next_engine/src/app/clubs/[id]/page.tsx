/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { clubMembers } from "@/lib/db/schema";
import ClubApplicationForm from "@/components/ClubApplicationForm";
import ClubApplications from "@/components/ClubApplications";
import ClubManagement from "@/components/ClubManagement";
import { getPublicClub } from "../data";

export const dynamic = "force-dynamic";
// 비공개 동아리는 인증된 운영자 또는 관리자에게만 보이며 운영 도구도 권한에 따라 표시한다.
// 기능 `ClubPage`({ params }): 먼저 `const slug = (await params).id;`를 실행한다.
export default async function ClubPage({ params }: { params: Promise<{ id: string }> }) {
  const slug = (await params).id;
  const viewer = await getCurrentUser(await headers());
  let club = await getPublicClub(slug);
  // 조건 `!club && viewer?.emailVerified && viewer.status === "ACTIVE_STUDENT"`: 참이면 먼저 `const candidate = await getPublicClub(slug, true);`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!club && viewer?.emailVerified`: 참인 경우에만 오른쪽 `viewer.status === "ACTIVE_STUDENT"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!club`: 참인 경우에만 오른쪽 `viewer?.emailVerified`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!club && viewer?.emailVerified && viewer.status === "ACTIVE_STUDENT") {
    const candidate = await getPublicClub(slug, true);
    // 조건 `candidate`: 참이면 먼저 `const [membership] = await getDb().select({ role: clubMembers.role }).from(clubMembers).where(and(eq(clubMembers.clubId, candidate.id), eq(clubMembers.userId, viewer.id), inArray(clubMembers.role, ["owner", "manager"])));`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (candidate) {
      const [membership] = await getDb().select({ role: clubMembers.role }).from(clubMembers).where(and(eq(clubMembers.clubId, candidate.id), eq(clubMembers.userId, viewer.id), inArray(clubMembers.role, ["owner", "manager"])));
      // 조건 `viewer.role === "admin" || membership`: 참이면 먼저 `club = candidate;`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
      // 단락 분기 `viewer.role === "admin"`: 거짓인 경우에만 오른쪽 `membership`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
      if (viewer.role === "admin" || membership) club = candidate;
    }
  }
  // 조건 `!club`: 참이면 먼저 `notFound();`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!club) notFound();
  // 단락 분기 `viewer?.emailVerified`: 참인 경우에만 오른쪽 `viewer.status === "ACTIVE_STUDENT"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  const active = Boolean(viewer?.emailVerified && viewer.status === "ACTIVE_STUDENT");
  let manager = false;
  // 조건 `viewer && active`: 참이면 먼저 `const [membership] = await getDb().select({ role: clubMembers.role }).from(clubMembers).where(and(eq(clubMembers.clubId, club.id), eq(clubMembers.userId, viewer.id), inArray(clubMembers.role, ["owner", "manager"])));`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `viewer`: 참인 경우에만 오른쪽 `active`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (viewer && active) {
    const [membership] = await getDb().select({ role: clubMembers.role }).from(clubMembers).where(and(eq(clubMembers.clubId, club.id), eq(clubMembers.userId, viewer.id), inArray(clubMembers.role, ["owner", "manager"])));
    // 단락 분기 `viewer.role === "admin"`: 거짓인 경우에만 오른쪽 `Boolean(membership)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    manager = viewer.role === "admin" || Boolean(membership);
  }
  const now = Date.now();
  // 단락 분기 `club.recruitments.length === 0`: 참인 경우에만 오른쪽 `<p className="empty-note">등록된 모집 공고가 없습니다.</p>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 기능 `콜백`(item): 먼저 `const open = item.isOpen && item.opensAt.getTime() <= now && item.closesAt.getTime() > now;`를 실행한다.
  // 단락 분기 `item.isOpen && item.opensAt.getTime() <= now`: 참인 경우에만 오른쪽 `item.closesAt.getTime() > now`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `item.isOpen`: 참인 경우에만 오른쪽 `item.opensAt.getTime() <= now`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 선택 조건 `open`: 참이면 `"모집 중"`, 거짓이면 `"모집 마감"`를 사용한다.
  // 선택 조건 `active`: 참이면 `<ClubApplicationForm slug={club.slug} recruitmentId={item.id} open={open} />`, 거짓이면 `open && <Link className="text-link" href="/auth/login">학생 로그인 후 지원하기 ↗</Link>`를 사용한다.
  // 단락 분기 `open`: 참인 경우에만 오른쪽 `<Link className="text-link" href="/auth/login">학생 로그인 후 지원하기 ↗</Link>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `club.posts.length === 0`: 참인 경우에만 오른쪽 `<p className="empty-note">아직 공개된 소식이 없습니다.</p>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 기능 `콜백`(post): `<article className="empty-note" key={post.id}><h3>{post.title}</h3><p>{post.content}</p></article>` 평가 결과를 반환한다.
  // 단락 분기 `manager`: 참인 경우에만 오른쪽 `<><ClubManagement club={club} /><ClubApplications slug={club.slug} /></>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  return <div className="subpage page-shell"><Link className="text-link" href="/clubs">← 동아리 목록</Link><div className="subpage-heading" style={{ marginTop: 40 }}><div><p className="eyebrow">{club.category}</p><h1>{club.name}</h1><p>{club.introduction}</p></div></div>
    <section className="services-section"><h2>모집 공고</h2>{club.recruitments.length === 0 && <p className="empty-note">등록된 모집 공고가 없습니다.</p>}{club.recruitments.map((item) => { const open = item.isOpen && item.opensAt.getTime() <= now && item.closesAt.getTime() > now; return <article className="empty-note" key={item.id}><h3>{item.title}</h3><p>{item.description}</p><p>모집 기간: {item.opensAt.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} – {item.closesAt.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} · {open ? "모집 중" : "모집 마감"}</p>{active ? <ClubApplicationForm slug={club.slug} recruitmentId={item.id} open={open} /> : open && <Link className="text-link" href="/auth/login">학생 로그인 후 지원하기 ↗</Link>}</article>; })}</section>
    <section className="services-section"><h2>동아리 소식</h2>{club.posts.length === 0 && <p className="empty-note">아직 공개된 소식이 없습니다.</p>}{club.posts.map((post) => <article className="empty-note" key={post.id}><h3>{post.title}</h3><p>{post.content}</p></article>)}</section>
    {manager && <><ClubManagement club={club} /><ClubApplications slug={club.slug} /></>}
  </div>;
}
