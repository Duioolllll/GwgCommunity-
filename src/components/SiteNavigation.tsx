"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navigation = [
  { href: "/market", label: "Gwg Market" },
  { href: "/clubs", label: "Gwg Clubs" },
  { href: "/finder", label: "Gwg Finder" },
];

export default function SiteNavigation() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

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
