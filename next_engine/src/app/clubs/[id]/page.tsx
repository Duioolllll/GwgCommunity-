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
// 이 주소에서 보여줄 화면에 필요한 자료를 준비하고 화면을 만든다.
export default async function ClubPage({ params }: { params: Promise<{ id: string }> }) {
  const slug = (await params).id;
  const viewer = await getCurrentUser(await headers());
  let club = await getPublicClub(slug);
  // 확인할 조건: ((동아리 없음 또는 false) 그리고 (viewer의 이메일 인증 여부 있음 또는 true)) 그리고 (viewer의 상태 = “인증된 학생”). 해당하면 이 경우에 필요한 자료를 준비한다.
  if (!club && viewer?.emailVerified && viewer.status === "ACTIVE_STUDENT") {
    const candidate = await getPublicClub(slug, true);
    // 확인할 조건: 추천 후보 있음 또는 true. 해당하면 이 경우에 필요한 자료를 준비한다.
    if (candidate) {
      const [membership] = await getDb().select({ role: clubMembers.role }).from(clubMembers).where(and(eq(clubMembers.clubId, candidate.id), eq(clubMembers.userId, viewer.id), inArray(clubMembers.role, ["owner", "manager"])));
      // 확인할 조건: (viewer의 권한 = “관리자”) 또는 (membership 있음 또는 true). 해당하면 동아리을 추천 후보으로 바꾼다.
      if (viewer.role === "admin" || membership) club = candidate;
    }
  }
  // 확인할 조건: 동아리 없음 또는 false. 해당하면 아래에 있는 작업을 실행한다.
  if (!club) notFound();
  const active = Boolean(viewer?.emailVerified && viewer.status === "ACTIVE_STUDENT");
  let manager = false;
  // 확인할 조건: (viewer 있음 또는 true) 그리고 (진행 중 표시 있음 또는 true). 해당하면 이 경우에 필요한 자료를 준비한다.
  if (viewer && active) {
    const [membership] = await getDb().select({ role: clubMembers.role }).from(clubMembers).where(and(eq(clubMembers.clubId, club.id), eq(clubMembers.userId, viewer.id), inArray(clubMembers.role, ["owner", "manager"])));
    manager = viewer.role === "admin" || Boolean(membership);
  }
  const now = Date.now();
  // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
  // 선택 기준: open 있음 또는 true. 맞으면 “모집 중” 값을 사용하고, 아니면 “모집 마감” 값을 사용한다.
  // 운영자 여부이 있거나 조건에 맞을 때만 해당 화면을 보여준다.
  return <div className="subpage page-shell"><Link className="text-link" href="/clubs">← 동아리 목록</Link><div className="subpage-heading" style={{ marginTop: 40 }}><div><p className="eyebrow">{club.category}</p><h1>{club.name}</h1><p>{club.introduction}</p></div></div>
    <section className="services-section"><h2>모집 공고</h2>{club.recruitments.length === 0 && <p className="empty-note">등록된 모집 공고가 없습니다.</p>}{club.recruitments.map((item) => { const open = item.isOpen && item.opensAt.getTime() <= now && item.closesAt.getTime() > now; return <article className="empty-note" key={item.id}><h3>{item.title}</h3><p>{item.description}</p><p>모집 기간: {item.opensAt.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} – {item.closesAt.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} · {open ? "모집 중" : "모집 마감"}</p>{active ? <ClubApplicationForm slug={club.slug} recruitmentId={item.id} open={open} /> : open && <Link className="text-link" href="/auth/login">학생 로그인 후 지원하기 ↗</Link>}</article>; })}</section>
    <section className="services-section"><h2>동아리 소식</h2>{club.posts.length === 0 && <p className="empty-note">아직 공개된 소식이 없습니다.</p>}{club.posts.map((post) => <article className="empty-note" key={post.id}><h3>{post.title}</h3><p>{post.content}</p></article>)}</section>
    {manager && <><ClubManagement club={club} /><ClubApplications slug={club.slug} /></>}
  </div>;
}
