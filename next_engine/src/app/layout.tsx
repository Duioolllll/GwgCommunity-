import type { Metadata } from "next";
import Link from "next/link";
import SiteNavigation from "@/components/SiteNavigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "GwgCommunity | 학생이 만드는 학교생활 커뮤니티",
  description: "광덕고 학생을 위한 Market, Clubs, Finder",
};

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
