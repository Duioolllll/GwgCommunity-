/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import type { Metadata } from "next";
import Link from "next/link";
import SiteNavigation from "@/components/SiteNavigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "GwgCommunity | 학생이 만드는 학교생활 커뮤니티",
  description: "광덕고 학생을 위한 Market, Clubs, Finder",
};

// 모든 화면에 공통 내비게이션, 본문 접근 링크와 푸터를 감싼다.
// 기능 `RootLayout`({ children, }): `( <html lang="ko"> <body> <a className="skip-link" href="#main-content">본문으로 바로가기</a> <header className="site-header"> <div className="header-inner"> <Link className="brand" href="/"> <span className="brand-mark">G</span> <span>GwgCommunity</span> </Link> <SiteNavigation /> </div> </header> <main id="main-content" tabIndex={-1}>{children}</main> <footer className="site-footer"> <div> <strong>GwgCommunity</strong> <p>학생이 만들고 학생이 사용하는 비공식 학교생활 커뮤니티</p> </div> <span>© 2026 GwgCommunity</span> </footer> </body> </html> )`를 반환한다.
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <a className="skip-link" href="#main-content">본문으로 바로가기</a>
        <header className="site-header">
          <div className="header-inner">
            <Link className="brand" href="/">
              <span className="brand-mark">G</span>
              <span>GwgCommunity</span>
            </Link>
            <SiteNavigation />
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>{children}</main>
        <footer className="site-footer">
          <div>
            <strong>GwgCommunity</strong>
            <p>학생이 만들고 학생이 사용하는 비공식 학교생활 커뮤니티</p>
          </div>
          <span>© 2026 GwgCommunity</span>
        </footer>
      </body>
    </html>
  );
}
