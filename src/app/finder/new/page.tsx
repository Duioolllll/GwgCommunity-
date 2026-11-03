import Link from "next/link";
import { FinderForm } from "@/components/FinderForm";

export default function NewFinderPage() {
  return <div className="auth-page page-shell"><div className="auth-card">
    <p className="eyebrow">GWG FINDER / NEW</p>
    <h1>분실물 등록</h1>
    <p>정확한 위치나 개인정보 대신 대략적인 정보만 공개합니다.</p>
    <FinderForm />
    <p className="auth-footer"><Link href="/finder">← Finder로 돌아가기</Link></p>
  </div></div>;
}
