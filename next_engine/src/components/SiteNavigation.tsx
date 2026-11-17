"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navigation = [
  { href: "/market", label: "Gwg Market" },
  { href: "/clubs", label: "Gwg Clubs" },
  { href: "/finder", label: "Gwg Finder" },
];

// 현재 하위 경로도 활성 메뉴로 표시하고 모바일 메뉴는 Escape로 닫는다.
// 화면 크기와 로그인 상태에 맞는 메뉴을 만든다.
export default function SiteNavigation() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
  // 선택 기준: (pathname = 현재 항목의 href) 또는 (startsWith 처리 결과 있음 또는 true). 맞으면 “page” 값을 사용하고, 아니면 undefined를 사용한다.
  // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
  // 선택 기준: open 있음 또는 true. 맞으면 “닫기” 값을 사용하고, 아니면 “메뉴” 값을 사용한다.
  return (
    <>
      <nav className="desktop-nav" aria-label="주요 메뉴">
        {navigation.map((item) => (
          <Link key={item.href} href={item.href} aria-current={pathname === item.href || pathname.startsWith(`${item.href}/`) ? "page" : undefined}>
            {item.label}
          </Link>
        ))}
      </nav>
      <Link className="header-login" href="/auth/login">로그인</Link>
      <div className="mobile-navigation" onKeyDown={(event) => {
        // 확인할 조건: (event의 저장 위치 = “Escape”) 그리고 (open 있음 또는 true). 해당하면 아래에 있는 작업을 실행한다.
        if (event.key === "Escape" && open) {
          setOpen(false);
          event.currentTarget.querySelector<HTMLButtonElement>("button")?.focus();
        }
      }}>
        <button className="mobile-menu-toggle" type="button" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(!open)}>
          <span aria-hidden="true" className="mobile-menu-icon"><span /><span /></span>
          <span>{open ? "닫기" : "메뉴"}</span>
        </button>
        <nav id="mobile-menu" className="mobile-menu" aria-label="모바일 주요 메뉴" hidden={!open}>
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} aria-current={pathname === item.href || pathname.startsWith(`${item.href}/`) ? "page" : undefined} onClick={() => setOpen(false)}>
              {item.label}<span aria-hidden="true">↗</span>
            </Link>
          ))}
          <Link href="/auth/login" onClick={() => setOpen(false)}>로그인<span aria-hidden="true">↗</span></Link>
        </nav>
      </div>
    </>
  );
}
