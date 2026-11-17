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
// 이 주소에서 보여줄 화면에 필요한 자료를 준비하고 화면을 만든다.
export default async function EditMarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 확인할 조건: 고유 번호을 검사한 결과의 입력 검사 통과 여부 없음 또는 false. 해당하면 아래에 있는 작업을 실행한다.
  if (!marketId.safeParse(id).success) notFound();
  const user = await getCurrentUser(await headers());
  // 확인할 조건: ((사용자 없음 또는 false) 또는 (사용자의 이메일 인증 여부 없음 또는 false)) 또는 (사용자의 상태 ≠ “인증된 학생”). 해당하면 해당 화면을 돌려준다.
  if (!user || !user.emailVerified || user.status !== "ACTIVE_STUDENT") return <div className="auth-page page-shell"><div className="auth-card"><h1>학생 인증이 필요합니다.</h1><Link className="text-link" href="/auth/login">로그인하기 ↗</Link></div></div>;
  const [post] = await getDb().select().from(marketPosts).where(eq(marketPosts.id, id));
  // 확인할 조건: 게시글 없음 또는 false. 해당하면 아래에 있는 작업을 실행한다.
  if (!post) notFound();
  // 확인할 조건: (게시글의 작성자 번호 ≠ 사용자의 고유 번호) 또는 (게시글의 상태 ≠ “판매 중”). 해당하면 해당 화면을 돌려준다.
  if (post.ownerId !== user.id || post.status !== "AVAILABLE") return <div className="auth-page page-shell"><div className="auth-card"><h1>상품을 수정할 수 없습니다.</h1><Link className="text-link" href={`/market/${id}`}>상품으로 돌아가기 ↗</Link></div></div>;
  return <div className="auth-page page-shell"><div className="auth-card"><p className="eyebrow">GWG MARKET / EDIT</p><h1>상품 수정</h1><MarketForm initial={post} /><p className="auth-footer"><Link href={`/market/${id}`}>← 상품으로 돌아가기</Link></p></div></div>;
}
