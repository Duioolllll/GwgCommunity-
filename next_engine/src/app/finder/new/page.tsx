import Link from "next/link";
import { FinderForm } from "@/components/FinderForm";

// 공개 정보에 주의하도록 안내하고 신규 분실물 폼을 표시한다.
// 이 주소에서 보여줄 화면에 필요한 자료를 준비하고 화면을 만든다.
export default function NewFinderPage() {
  return <div className="auth-page page-shell"><div className="auth-card">
    <p className="eyebrow">GWG FINDER / NEW</p>
    <h1>분실물 등록</h1>
    <p>정확한 위치나 개인정보 대신 대략적인 정보만 공개합니다.</p>
    <FinderForm />
    <p className="auth-footer"><Link href="/finder">← Finder로 돌아가기</Link></p>
  </div></div>;
}
