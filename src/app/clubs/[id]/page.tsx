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
export default async function ClubPage({ params }: { params: Promise<{ id: string }> }) {
  const slug = (await params).id;
  const viewer = await getCurrentUser(await headers());
  let club = await getPublicClub(slug);
  if (!club && viewer?.emailVerified && viewer.status === "ACTIVE_STUDENT") {
    const candidate = await getPublicClub(slug, true);
    if (candidate) {
      const [membership] = await getDb().select({ role: clubMembers.role }).from(clubMembers).where(and(eq(clubMembers.clubId, candidate.id), eq(clubMembers.userId, viewer.id), inArray(clubMembers.role, ["owner", "manager"])));
      if (viewer.role === "admin" || membership) club = candidate;
    }
  }
  if (!club) notFound();
  const active = Boolean(viewer?.emailVerified && viewer.status === "ACTIVE_STUDENT");
  let manager = false;
  if (viewer && active) {
    const [membership] = await getDb().select({ role: clubMembers.role }).from(clubMembers).where(and(eq(clubMembers.clubId, club.id), eq(clubMembers.userId, viewer.id), inArray(clubMembers.role, ["owner", "manager"])));
    manager = viewer.role === "admin" || Boolean(membership);
  }
  const now = Date.now();
  return <div className="subpage page-shell"><Link className="text-link" href="/clubs">← 동아리 목록</Link><div className="subpage-heading" style={{ marginTop: 40 }}><div><p className="eyebrow">{club.category}</p><h1>{club.name}</h1><p>{club.introduction}</p></div></div>
    <section className="services-section"><h2>모집 공고</h2>{club.recruitments.length === 0 && <p className="empty-note">등록된 모집 공고가 없습니다.</p>}{club.recruitments.map((item) => { const open = item.isOpen && item.opensAt.getTime() <= now && item.closesAt.getTime() > now; return <article className="empty-note" key={item.id}><h3>{item.title}</h3><p>{item.description}</p><p>모집 기간: {item.opensAt.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} – {item.closesAt.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} · {open ? "모집 중" : "모집 마감"}</p>{active ? <ClubApplicationForm slug={club.slug} recruitmentId={item.id} open={open} /> : open && <Link className="text-link" href="/auth/login">학생 로그인 후 지원하기 ↗</Link>}</article>; })}</section>
    <section className="services-section"><h2>동아리 소식</h2>{club.posts.length === 0 && <p className="empty-note">아직 공개된 소식이 없습니다.</p>}{club.posts.map((post) => <article className="empty-note" key={post.id}><h3>{post.title}</h3><p>{post.content}</p></article>)}</section>
    {manager && <><ClubManagement club={club} /><ClubApplications slug={club.slug} /></>}
  </div>;
}
