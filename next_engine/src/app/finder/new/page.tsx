/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import Link from "next/link";
import { FinderForm } from "@/components/FinderForm";

// 공개 정보에 주의하도록 안내하고 신규 분실물 폼을 표시한다.
// 기능 `NewFinderPage`(): `<div className="auth-page page-shell"><div className="auth-card"> <p className="eyebrow">GWG FINDER / NEW</p> <h1>분실물 등록</h1> <p>정확한 위치나 개인정보 대신 대략적인 정보만 공개합니다.</p> <FinderForm /> <p className="auth-footer"><Link href="/finder">← Finder로 돌아가기</Link></p> </div></div>`를 반환한다.
export default function NewFinderPage() {
  return <div className="auth-page page-shell"><div className="auth-card">
    <p className="eyebrow">GWG FINDER / NEW</p>
    <h1>분실물 등록</h1>
    <p>정확한 위치나 개인정보 대신 대략적인 정보만 공개합니다.</p>
    <FinderForm />
    <p className="auth-footer"><Link href="/finder">← Finder로 돌아가기</Link></p>
  </div></div>;
}
