import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "GwgCommunity | 학생이 만드는 학교생활 커뮤니티",
  description: "광덕고 학생을 위한 Market, Clubs, Finder",
};

const navigation = [
  { href: "/market", label: "Gwg Market" },
  { href: "/clubs", label: "Gwg Clubs" },
  { href: "/finder", label: "Gwg Finder" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <header className="site-header">
          <div className="header-inner">
            <Link className="brand" href="/">
              <span className="brand-mark">G</span>
              <span>GwgCommunity</span>
            </Link>
            <nav className="desktop-nav" aria-label="주요 메뉴">
              {navigation.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <Link className="header-login" href="/auth/login">
              로그인
            </Link>
          </div>
        </header>
        <main>{children}</main>
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
