/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketForm } from "@/components/MarketForm";
import { marketId } from "@/features/market/data";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { marketPosts } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
// 활성 학생인 소유자의 판매 가능 상품만 수정할 수 있다.
// 기능 `EditMarketPage`({ params }): 먼저 `const { id } = await params;`를 실행한다.
export default async function EditMarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 조건 `!marketId.safeParse(id).success`: 참이면 먼저 `notFound();`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!marketId.safeParse(id).success) notFound();
  const user = await getCurrentUser(await headers());
  // 조건 `!user || !user.emailVerified || user.status !== "ACTIVE_STUDENT"`: 참이면 `<div className="auth-page page-shell"><div className="auth-card"><h1>학생 인증이 필요합니다.</h1><Link className="text-link" href="/auth/login">로그인하기 ↗</Link></div></div>`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!user || !user.emailVerified`: 거짓인 경우에만 오른쪽 `user.status !== "ACTIVE_STUDENT"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!user`: 거짓인 경우에만 오른쪽 `!user.emailVerified`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!user || !user.emailVerified || user.status !== "ACTIVE_STUDENT") return <div className="auth-page page-shell"><div className="auth-card"><h1>학생 인증이 필요합니다.</h1><Link className="text-link" href="/auth/login">로그인하기 ↗</Link></div></div>;
  const [post] = await getDb().select().from(marketPosts).where(eq(marketPosts.id, id));
  // 조건 `!post`: 참이면 먼저 `notFound();`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!post) notFound();
  // 조건 `post.ownerId !== user.id || post.status !== "AVAILABLE"`: 참이면 `<div className="auth-page page-shell"><div className="auth-card"><h1>상품을 수정할 수 없습니다.</h1><Link className="text-link" href={`/market/${id}`}>상품으로 돌아가기 ↗</Link></div></div>`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `post.ownerId !== user.id`: 거짓인 경우에만 오른쪽 `post.status !== "AVAILABLE"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (post.ownerId !== user.id || post.status !== "AVAILABLE") return <div className="auth-page page-shell"><div className="auth-card"><h1>상품을 수정할 수 없습니다.</h1><Link className="text-link" href={`/market/${id}`}>상품으로 돌아가기 ↗</Link></div></div>;
  return <div className="auth-page page-shell"><div className="auth-card"><p className="eyebrow">GWG MARKET / EDIT</p><h1>상품 수정</h1><MarketForm initial={post} /><p className="auth-footer"><Link href={`/market/${id}`}>← 상품으로 돌아가기</Link></p></div></div>;
}
