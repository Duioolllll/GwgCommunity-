/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import Link from "next/link";
import { headers } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { clubApplications, clubRecruitments, clubs, finderPosts, marketPosts, marketReservations } from "@/lib/db/schema";
import { marketStatusLabels } from "@/features/market/data";
import { InvitationForm } from "@/components/AuthForm";
import { SignOut } from "@/components/SignOut";

export const dynamic = "force-dynamic";
// 계정 상태에 따라 인증 안내를 우선하고 활성 학생의 최근 활동을 종류별 20개까지 조회한다.
// 기능 `MePage`(): 먼저 `const user = await getCurrentUser(await headers());`를 실행한다.
export default async function MePage() {
  const user = await getCurrentUser(await headers());
  // 조건 `!user`: 참이면 `<div className="auth-page page-shell"><div className="auth-card"><p className="eyebrow">MY PAGE</p><h1>로그인이 필요합니다.</h1><p>학생 전용 기능을 이용하려면 먼저 로그인하세요.</p><Link className="button button-dark" href="/auth/login">로그인하기</Link></div></div>`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!user) return <div className="auth-page page-shell"><div className="auth-card"><p className="eyebrow">MY PAGE</p><h1>로그인이 필요합니다.</h1><p>학생 전용 기능을 이용하려면 먼저 로그인하세요.</p><Link className="button button-dark" href="/auth/login">로그인하기</Link></div></div>;
  // 조건 `user.status === "SUSPENDED"`: 참이면 `<div className="auth-page page-shell"><div className="auth-card"><h1>이용이 정지된 계정입니다.</h1><SignOut /></div></div>`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (user.status === "SUSPENDED") return <div className="auth-page page-shell"><div className="auth-card"><h1>이용이 정지된 계정입니다.</h1><SignOut /></div></div>;
  // 조건 `user.status !== "ACTIVE_STUDENT" || !user.emailVerified`: 참이면 `<div className="auth-page page-shell"><div className="auth-card"><h1>학생 인증</h1><p>이메일 확인 후 발급받은 초대 코드를 입력하세요.</p><InvitationForm /><SignOut /></div></div>`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `user.status !== "ACTIVE_STUDENT"`: 거짓인 경우에만 오른쪽 `!user.emailVerified`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (user.status !== "ACTIVE_STUDENT" || !user.emailVerified) return <div className="auth-page page-shell"><div className="auth-card"><h1>학생 인증</h1><p>이메일 확인 후 발급받은 초대 코드를 입력하세요.</p><InvitationForm /><SignOut /></div></div>;
  const db = getDb();
  const [market, reservations, finder, applications] = await Promise.all([
    db.select({ id: marketPosts.id, title: marketPosts.title, status: marketPosts.status }).from(marketPosts).where(eq(marketPosts.ownerId, user.id)).orderBy(desc(marketPosts.createdAt)).limit(20),
    db.select({ reservationId: marketReservations.id, id: marketPosts.id, title: marketPosts.title, status: marketReservations.status }).from(marketReservations).innerJoin(marketPosts, eq(marketReservations.postId, marketPosts.id)).where(eq(marketReservations.requesterId, user.id)).orderBy(desc(marketReservations.createdAt)).limit(20),
    db.select({ id: finderPosts.id, title: finderPosts.title, kind: finderPosts.kind, status: finderPosts.status }).from(finderPosts).where(eq(finderPosts.ownerId, user.id)).orderBy(desc(finderPosts.createdAt)).limit(20),
    db.select({ applicationId: clubApplications.id, clubSlug: clubs.slug, clubName: clubs.name, title: clubRecruitments.title, status: clubApplications.status }).from(clubApplications).innerJoin(clubRecruitments, eq(clubRecruitments.id, clubApplications.recruitmentId)).innerJoin(clubs, eq(clubs.id, clubRecruitments.clubId)).where(eq(clubApplications.applicantId, user.id)).orderBy(desc(clubApplications.createdAt)).limit(20),
  ]);
  const applicationLabels = { SUBMITTED: "접수", IN_REVIEW: "검토 중", ACCEPTED: "승인", REJECTED: "거절", CANCELLED: "취소" } as const;
  const reservationLabels = { ACTIVE: "예약 중", CANCELLED: "취소", COMPLETED: "거래 완료" } as const;
  // 선택 조건 `user.role === "admin"`: 참이면 `"관리자"`, 거짓이면 `"학생"`를 사용한다.
  // 단락 분기 `user.role === "admin"`: 참인 경우에만 오른쪽 `<Link className="quick-card" href="/admin">관리자 페이지 <span>↗</span></Link>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 선택 조건 `market.length`: 참이면 `<ul>{market.map(item => <li key={item.id}><Link href={`/market/${item.id}`}>{item.title}</Link><span>{marketStatusLabels[item.status]}</span></li>)}</ul>`, 거짓이면 `<p className="muted-copy">등록한 상품이 없습니다.</p>`를 사용한다.
  // 기능 `콜백`(item): `<li key={item.id}><Link href={`/market/${item.id}`}>{item.title}</Link><span>{marketStatusLabels[item.status]}</span></li>` 평가 결과를 반환한다.
  // 선택 조건 `reservations.length`: 참이면 `<ul>{reservations.map(item => <li key={item.reservationId}><Link href={`/market/${item.id}`}>{item.title}</Link><span>{reservationLabels[item.status]}</span></li>)}</ul>`, 거짓이면 `<p className="muted-copy">신청한 거래가 없습니다.</p>`를 사용한다.
  // 기능 `콜백`(item): `<li key={item.reservationId}><Link href={`/market/${item.id}`}>{item.title}</Link><span>{reservationLabels[item.status]}</span></li>` 평가 결과를 반환한다.
  // 선택 조건 `finder.length`: 참이면 `<ul>{finder.map(item => <li key={item.id}><Link href={`/finder/${item.id}`}>{item.title}</Link><span>{item.kind === "lost" ? "분실" : "습득"} · {item.status === "ACTIVE" ? "진행 중" : "종료"}</span></li>)}</ul>`, 거짓이면 `<p className="muted-copy">등록한 분실물 글이 없습니다.</p>`를 사용한다.
  // 기능 `콜백`(item): `<li key={item.id}><Link href={`/finder/${item.id}`}>{item.title}</Link><span>{item.kind === "lost" ? "분실" : "습득"} · {item.status === "ACTIVE" ? "진행 중" : "종료"}</span></li>` 평가 결과를 반환한다.
  // 선택 조건 `item.kind === "lost"`: 참이면 `"분실"`, 거짓이면 `"습득"`를 사용한다.
  // 선택 조건 `item.status === "ACTIVE"`: 참이면 `"진행 중"`, 거짓이면 `"종료"`를 사용한다.
  // 선택 조건 `applications.length`: 참이면 `<ul>{applications.map(item => <li key={item.applicationId}><Link href={`/clubs/${encodeURIComponent(item.clubSlug)}`}>{item.clubName} · {item.title}</Link><span>{applicationLabels[item.status]}</span></li>)}</ul>`, 거짓이면 `<p className="muted-copy">지원한 동아리가 없습니다.</p>`를 사용한다.
  // 기능 `콜백`(item): `<li key={item.applicationId}><Link href={`/clubs/${encodeURIComponent(item.clubSlug)}`}>{item.clubName} · {item.title}</Link><span>{applicationLabels[item.status]}</span></li>` 평가 결과를 반환한다.
  return <div className="subpage page-shell"><div className="subpage-heading"><div><p className="eyebrow">MY PAGE</p><h1>{user.name}님, 안녕하세요.</h1><p>{user.email} · {user.role === "admin" ? "관리자" : "학생"}</p></div><SignOut /></div>
    <div className="quick-grid"><Link className="quick-card" href="/market/new">Market 상품 등록 <span>↗</span></Link><Link className="quick-card" href="/finder/new">Finder 분실물 등록 <span>↗</span></Link>{user.role === "admin" && <Link className="quick-card" href="/admin">관리자 페이지 <span>↗</span></Link>}</div>
    <div className="my-sections">
      <section><h2>내 상품</h2>{market.length ? <ul>{market.map(item => <li key={item.id}><Link href={`/market/${item.id}`}>{item.title}</Link><span>{marketStatusLabels[item.status]}</span></li>)}</ul> : <p className="muted-copy">등록한 상품이 없습니다.</p>}</section>
      <section><h2>내 거래 신청</h2>{reservations.length ? <ul>{reservations.map(item => <li key={item.reservationId}><Link href={`/market/${item.id}`}>{item.title}</Link><span>{reservationLabels[item.status]}</span></li>)}</ul> : <p className="muted-copy">신청한 거래가 없습니다.</p>}</section>
      <section><h2>내 분실물 글</h2>{finder.length ? <ul>{finder.map(item => <li key={item.id}><Link href={`/finder/${item.id}`}>{item.title}</Link><span>{item.kind === "lost" ? "분실" : "습득"} · {item.status === "ACTIVE" ? "진행 중" : "종료"}</span></li>)}</ul> : <p className="muted-copy">등록한 분실물 글이 없습니다.</p>}</section>
      <section><h2>동아리 지원</h2>{applications.length ? <ul>{applications.map(item => <li key={item.applicationId}><Link href={`/clubs/${encodeURIComponent(item.clubSlug)}`}>{item.clubName} · {item.title}</Link><span>{applicationLabels[item.status]}</span></li>)}</ul> : <p className="muted-copy">지원한 동아리가 없습니다.</p>}</section>
    </div>
  </div>;
}
