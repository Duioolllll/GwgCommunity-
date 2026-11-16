/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
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
// 기능 `SiteNavigation`(): 먼저 `const [open, setOpen] = useState(false);`를 실행한다.
export default function SiteNavigation() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // 기능 `콜백`(item): `( <Link key={item.href} href={item.href} aria-current={pathname === item.href || pathname.startsWith(`${item.href}/`) ? "page" : undefined}> {item.label} </Link> )` 평가 결과를 반환한다.
  // 선택 조건 `pathname === item.href || pathname.startsWith(`${item.href}/`)`: 참이면 `"page"`, 거짓이면 `undefined`를 사용한다.
  // 단락 분기 `pathname === item.href`: 거짓인 경우에만 오른쪽 `pathname.startsWith(`${item.href}/`)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 기능 `콜백`(event): `event.key === "Escape" && open` 조건을 추가로 검사한다.
  // 기능 `콜백`(): `setOpen(!open)` 평가 결과를 반환한다.
  // 선택 조건 `open`: 참이면 `"닫기"`, 거짓이면 `"메뉴"`를 사용한다.
  // 기능 `콜백`(item): `( <Link key={item.href} href={item.href} aria-current={pathname === item.href || pathname.startsWith(`${item.href}/`) ? "page" : undefined} onClick={() => setOpen(false)}> {item.label}<span aria-hidden="true">↗</span> </Link> )` 평가 결과를 반환한다.
  // 선택 조건 `pathname === item.href || pathname.startsWith(`${item.href}/`)`: 참이면 `"page"`, 거짓이면 `undefined`를 사용한다.
  // 단락 분기 `pathname === item.href`: 거짓인 경우에만 오른쪽 `pathname.startsWith(`${item.href}/`)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 기능 `콜백`(): `setOpen(false)` 평가 결과를 반환한다.
  // 기능 `콜백`(): `setOpen(false)` 평가 결과를 반환한다.
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
        // 조건 `event.key === "Escape" && open`: 참이면 먼저 `setOpen(false);`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
        // 단락 분기 `event.key === "Escape"`: 참인 경우에만 오른쪽 `open`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
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
