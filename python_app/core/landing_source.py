"""Campus-magazine landing page for GwgCommunity.

Everything remains Python-owned: Django template markup and page-scoped CSS
live together here, without a JavaScript build step or external assets.
"""

LANDING_PAGE = r"""
{% extends 'base.html' %}
{% block title %}GwgCommunity | 우리 학교의 매일을 더 가깝게{% endblock %}
{% block page_styles %}
<style>
:root {
  --campus-ink: #202447;
  --campus-blue: #4747ee;
  --campus-blue-deep: #3332bb;
  --campus-paper: #f8f7f1;
  --campus-line: #d9d8e4;
  --campus-muted: #64677c;
}
html { scroll-behavior: smooth; }
body { background: var(--campus-paper); color: var(--campus-ink); }
.site-header { position: relative; z-index: 20; background: var(--campus-paper); border-bottom: 1px solid var(--campus-line); }
.site-header .header-inner { width: min(1240px, calc(100% - 64px)); min-height: 84px; gap: 60px; }
.site-header .brand { color: var(--campus-ink); font-size: 17px; font-weight: 800; letter-spacing: -.055em; }
.site-header .brand-mark { width: 34px; height: 34px; border-radius: 10px; background: var(--campus-blue); font-size: 17px; transform: rotate(-9deg); }
.site-header .desktop-nav { gap: 30px; font-weight: 600; font-size: 13px; }
.site-header .desktop-nav a:hover { color: var(--campus-blue); }
.site-header .header-login { border: 1px solid var(--campus-blue); border-radius: 100px; padding: 11px 21px; color: var(--campus-blue); font-size: 13px; font-weight: 700; }
.site-header .header-login:hover { background: var(--campus-blue); color: #fff; }
.site-header .header-login-form .header-login { background: transparent; }
.site-header .header-login-form .header-login:hover { background: var(--campus-blue); }
.site-header .mobile-menu { background: var(--campus-paper); border-color: var(--campus-line); }
.site-header .mobile-menu-toggle { color: var(--campus-ink); }
.landing { overflow: clip; font-family: "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", Arial, sans-serif; }
.landing a:focus-visible { outline: 3px solid var(--campus-blue); outline-offset: 5px; }
.landing-wrap { width: min(1240px, calc(100% - 64px)); margin-inline: auto; }
.landing-kicker { display: inline-flex; align-items: center; gap: 10px; font-size: 12px; letter-spacing: .15em; font-weight: 800; line-height: 1.5; text-transform: uppercase; }
.landing-kicker::before { content: ""; display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: var(--campus-blue); }
.landing-hero { display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(0, .92fr); align-items: center; gap: clamp(28px, 5vw, 86px); padding-top: 102px; padding-bottom: 110px; }
.landing-hero-copy { min-width: 0; }
.landing-hero .landing-kicker { margin: 0 0 30px; color: var(--campus-blue); }
.landing-hero h1 { margin: 0; font-size: clamp(49px, 6.15vw, 91px); line-height: 1.18; letter-spacing: -.09em; font-weight: 850; }
.landing-hero h1 .title-line { display: block; white-space: nowrap; }
.landing-hero h1 .title-highlight { display: inline-block; margin-top: 6px; padding: 0 13px 8px 8px; color: #fff; background: var(--campus-blue); transform: rotate(-1.2deg); box-decoration-break: clone; }
.landing-lead { max-width: 440px; margin: 37px 0 0; color: #585c74; font-size: 16px; line-height: 1.85; letter-spacing: -.025em; }
.landing-hero-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin-top: 36px; }
.landing-btn { display: inline-flex; justify-content: center; align-items: center; gap: 22px; min-height: 54px; padding: 15px 21px; border: 1px solid var(--campus-blue); border-radius: 12px; background: var(--campus-blue); color: #fff; font-size: 14px; font-weight: 800; letter-spacing: -.02em; transition: transform .2s ease, background-color .2s ease, border-color .2s ease; }
.landing-btn:hover { transform: translateY(-3px); background: var(--campus-blue-deep); border-color: var(--campus-blue-deep); }
.landing-btn-secondary { background: transparent; color: var(--campus-ink); border-color: #c6c5d8; }
.landing-btn-secondary:hover { background: #eae9fc; border-color: var(--campus-blue); }
.landing-smallprint { margin: 21px 0 0; font-size: 12px; color: #777989; }
.landing-stage { position: relative; isolation: isolate; min-width: 0; padding: 18px 0 16px 18px; }
.landing-stage::before { content: ""; position: absolute; inset: 41px -16px -1px 51px; border-radius: 34px; background: #d9dbfb; transform: rotate(5deg); z-index: -1; }
.landing-stage-window { min-height: 520px; border: 1px solid #353b6e; border-radius: 29px; padding: 22px; background: #20264c; color: #fff; box-shadow: 0 28px 65px #29266d22; }
.landing-window-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 19px; border-bottom: 1px solid #4b5074; }
.landing-window-header strong { font-size: 12px; letter-spacing: .07em; }
.landing-window-dots { display: inline-flex; gap: 6px; }
.landing-window-dots i { display: block; width: 7px; height: 7px; border-radius: 50%; background: #777da5; }
.landing-window-dots i:first-child { background: #b5f3be; }
.landing-window-title { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; padding: 27px 0 25px; }
.landing-window-title p { margin: 0; color: #bbbdf6; font-size: 10px; letter-spacing: .16em; font-weight: 800; }
.landing-window-title h2 { margin: 8px 0 0; color: #fff; font-size: clamp(26px, 3vw, 36px); line-height: 1.25; letter-spacing: -.065em; font-weight: 750; }
.landing-spark { display: grid; width: 51px; height: 51px; flex: 0 0 51px; place-items: center; border: 1px solid #7c80ac; border-radius: 50%; color: #d7fa9f; font-size: 31px; }
.landing-window-list { display: grid; gap: 10px; }
.landing-window-link { display: grid; grid-template-columns: 48px minmax(0, 1fr) 20px; align-items: center; gap: 14px; min-height: 99px; padding: 17px 16px; border: 1px solid #ebeafa; border-radius: 15px; color: var(--campus-ink); background: #f5f2ff; transition: transform .2s ease, box-shadow .2s ease; }
.landing-window-link:nth-child(2) { background: #e0e6ff; transform: translateX(-9px); }
.landing-window-link:nth-child(3) { background: #dcf2df; }
.landing-window-link:hover { transform: translateX(-5px) rotate(-1deg); box-shadow: 0 10px 25px #090e3066; }
.landing-window-link:nth-child(2):hover { transform: translateX(-14px) rotate(-1deg); }
.landing-window-icon { display: grid; place-items: center; width: 48px; height: 48px; border: 1px solid #bdbce0; border-radius: 12px; font-size: 22px; font-weight: 900; }
.landing-window-link:nth-child(2) .landing-window-icon { border-color: #9da9df; }
.landing-window-link:nth-child(3) .landing-window-icon { border-color: #a4d8a7; }
.landing-window-link strong { display: block; margin-bottom: 4px; font-size: 16px; letter-spacing: -.055em; }
.landing-window-link small { display: block; color: #61647e; font-size: 11px; line-height: 1.5; }
.landing-window-arrow { align-self: start; justify-self: end; font-size: 19px; }
.landing-window-caption { display: flex; justify-content: space-between; gap: 14px; padding-top: 24px; color: #b2b5d5; font-size: 10px; letter-spacing: .11em; }
.landing-sticker { position: absolute; top: -5px; right: -18px; display: grid; place-items: center; width: 92px; height: 92px; border-radius: 50%; background: #dfff92; color: #282e5a; font-size: 12px; line-height: 1.4; font-weight: 900; text-align: center; transform: rotate(15deg); box-shadow: 0 7px 0 #1014461c; }
.landing-tape { position: absolute; bottom: 3px; left: -6px; width: 96px; height: 26px; background: #d8bffcaa; transform: rotate(-28deg); z-index: 2; }
.landing-ribbon { border-top: 1px solid #d4d2e4; border-bottom: 1px solid #d4d2e4; background: #efedff; }
.landing-ribbon-inner { display: flex; flex-wrap: wrap; gap: 14px 25px; align-items: center; justify-content: space-between; min-height: 73px; color: #4e5099; font-size: 12px; font-weight: 850; letter-spacing: .14em; }
.landing-ribbon-inner .ribbon-dot { color: #a7a3ef; font-size: 18px; }
.landing-section { padding-block: 112px; }
.landing-section-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 32px; margin-bottom: 42px; }
.landing-section-top .landing-kicker { margin: 0 0 18px; color: var(--campus-blue); }
.landing-section-top h2 { margin: 0; font-size: clamp(34px, 4.3vw, 58px); line-height: 1.27; letter-spacing: -.075em; font-weight: 820; }
.landing-section-top > p { max-width: 270px; margin: 0 0 6px; color: var(--campus-muted); font-size: 14px; line-height: 1.8; }
.landing-space-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.landing-space-card { display: flex; flex-direction: column; min-width: 0; min-height: 460px; padding: 28px; border-radius: 22px; overflow: hidden; position: relative; transition: transform .2s ease; }
.landing-space-card:hover { transform: translateY(-7px); }
.landing-space-card:focus-visible { outline-offset: 4px; }
.landing-space-card .space-topline { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 12px; font-weight: 800; letter-spacing: .13em; }
.landing-space-card .space-number { display: grid; place-items: center; width: 33px; height: 33px; border: 1px solid currentColor; border-radius: 50%; font-size: 11px; }
.landing-space-card h3 { margin: 28px 0 12px; font-size: 36px; line-height: 1.13; letter-spacing: -.075em; font-weight: 850; }
.landing-space-card p { max-width: 258px; margin: 0; font-size: 14px; line-height: 1.75; opacity: .8; }
.landing-space-card .space-illustration { position: relative; flex: 1; min-height: 148px; }
.landing-space-card .space-link { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 24px; padding-top: 18px; border-top: 1px solid currentColor; font-size: 13px; font-weight: 800; }
.landing-space-card .space-link span:last-child { font-size: 21px; transition: transform .2s ease; }
.landing-space-card:hover .space-link span:last-child { transform: translate(3px, -3px); }
.landing-space-market { background: #4747ee; color: #fff; }
.landing-space-clubs { background: #e9e5ff; color: #292866; }
.landing-space-finder { background: #dff0d8; color: #26472c; }
.landing-space-market .receipt { position: absolute; top: 27px; left: 50%; width: 150px; height: 132px; border-radius: 5px; transform: translateX(-50%) rotate(-9deg); background: #f8f7f1; box-shadow: 10px 12px 0 #b7aeff; }
.landing-space-market .receipt::before { content: "GWG / MARKET"; position: absolute; top: 20px; left: 17px; color: #3732a7; font-size: 10px; letter-spacing: .1em; font-weight: 900; }
.landing-space-market .receipt::after { content: ""; position: absolute; top: 53px; left: 17px; right: 17px; height: 51px; background: repeating-linear-gradient(to bottom, #9e9cdd 0, #9e9cdd 2px, transparent 2px, transparent 15px); }
.landing-space-clubs .club-orbit { position: absolute; top: 16px; left: calc(50% - 75px); width: 150px; height: 150px; border: 2px dashed #8a84d6; border-radius: 50%; }
.landing-space-clubs .club-orbit::before { content: "C"; position: absolute; top: -18px; left: -18px; display: grid; place-items: center; width: 67px; height: 67px; border-radius: 21px; color: #fff; background: #4747ee; font-size: 38px; font-weight: 850; transform: rotate(-12deg); }
.landing-space-clubs .club-orbit::after { content: "+"; position: absolute; right: -11px; bottom: -12px; display: grid; place-items: center; width: 54px; height: 54px; border-radius: 50%; color: #292866; background: #caff9d; font-size: 35px; font-weight: 700; }
.landing-space-finder .finder-lens { position: absolute; top: 17px; left: calc(50% - 68px); width: 134px; height: 134px; border: 14px solid #427d4c; border-radius: 50%; transform: rotate(-35deg); }
.landing-space-finder .finder-lens::after { content: ""; position: absolute; width: 23px; height: 77px; bottom: -72px; right: -12px; border-radius: 20px; background: #427d4c; transform: rotate(-35deg); transform-origin: top; }
.landing-space-finder .finder-lens::before { content: "?"; position: absolute; inset: 0; display: grid; place-items: center; color: #427d4c; font-size: 72px; font-weight: 850; }
.landing-how { border-top: 1px solid var(--campus-line); background: #f0efe9; }
.landing-how-grid { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 80px; align-items: start; }
.landing-how .landing-kicker { margin: 0 0 21px; color: var(--campus-blue); }
.landing-how h2 { margin: 0; font-size: clamp(34px, 4vw, 52px); line-height: 1.32; letter-spacing: -.07em; }
.landing-how .how-intro { max-width: 355px; margin: 26px 0 0; color: var(--campus-muted); font-size: 14px; line-height: 1.9; }
.landing-steps { margin: 0; padding: 0; list-style: none; border-top: 2px solid var(--campus-ink); }
.landing-steps li { display: grid; grid-template-columns: 45px minmax(0, 1fr); column-gap: 20px; padding: 29px 0; border-bottom: 1px solid #d1cfdc; }
.landing-steps .step-id { padding-top: 5px; color: var(--campus-blue); font-size: 13px; font-weight: 850; }
.landing-steps strong { display: block; margin-bottom: 8px; font-size: 19px; letter-spacing: -.04em; }
.landing-steps p { max-width: 460px; margin: 0; color: var(--campus-muted); font-size: 13px; line-height: 1.85; }
.landing-cta { padding-top: 102px; padding-bottom: 110px; }
.landing-cta-panel { display: flex; align-items: center; justify-content: space-between; gap: 40px; padding: 65px 70px; border-radius: 28px; background: var(--campus-ink); color: #fff; }
.landing-cta-panel .landing-kicker { margin: 0 0 18px; color: #c2f79c; }
.landing-cta-panel .landing-kicker::before { background: #c2f79c; }
.landing-cta-panel h2 { margin: 0; font-size: clamp(30px, 3.8vw, 49px); line-height: 1.3; letter-spacing: -.06em; font-weight: 800; }
.landing-cta-panel p:not(.landing-kicker) { margin: 18px 0 0; color: #c4c8df; font-size: 13px; line-height: 1.75; }
.landing-cta-panel .landing-btn { flex: 0 0 auto; border-color: #d8ff99; color: var(--campus-ink); background: #d8ff99; }
.landing-cta-panel .landing-btn:hover { background: #f0ffcf; border-color: #f0ffcf; }
.site-footer { background: #eae9e4; border-top: 1px solid var(--campus-line); color: #676980; }
.site-footer strong { color: var(--campus-ink); }
@media (max-width: 1100px) {
  .landing-hero { gap: 32px; }
  .landing-hero h1 { font-size: clamp(48px, 6.5vw, 72px); }
  .landing-stage-window { padding: 17px; }
  .landing-space-card { padding: 24px; }
}
@media (max-width: 760px) {
  .site-header .header-inner { width: calc(100% - 36px); min-height: 68px; }
  .landing-wrap { width: calc(100% - 36px); }
  .landing-hero { grid-template-columns: 1fr; padding-top: 69px; padding-bottom: 72px; gap: 55px; }
  .landing-hero h1 { font-size: clamp(47px, 11vw, 75px); }
  .landing-hero .landing-kicker { margin-bottom: 23px; }
  .landing-lead { margin-top: 30px; font-size: 15px; }
  .landing-stage { width: min(100% - 10px, 510px); margin-inline: auto; padding: 10px 3px 10px 10px; }
  .landing-stage-window { min-height: auto; }
  .landing-sticker { width: 72px; height: 72px; top: -16px; right: -7px; font-size: 10px; }
  .landing-ribbon-inner { justify-content: center; gap: 12px 17px; padding-block: 18px; text-align: center; }
  .landing-section { padding-block: 75px; }
  .landing-section-top { display: block; }
  .landing-section-top > p { margin-top: 18px; }
  .landing-space-grid { grid-template-columns: 1fr; }
  .landing-space-card { min-height: 380px; }
  .landing-space-card .space-illustration { min-height: 125px; }
  .landing-how-grid { grid-template-columns: 1fr; gap: 45px; }
  .landing-cta { padding-block: 75px; }
  .landing-cta-panel { display: block; padding: 42px 30px; }
  .landing-cta-panel .landing-btn { margin-top: 27px; }
}
@media (max-width: 420px) {
  .landing-hero h1 { font-size: clamp(39px, 10.7vw, 48px); }
  .landing-hero h1 .title-highlight { padding-right: 7px; }
  .landing-hero-actions { align-items: stretch; }
  .landing-btn { min-height: 51px; gap: 14px; padding-inline: 16px; }
  .landing-window-link { grid-template-columns: 40px minmax(0, 1fr) 16px; gap: 11px; padding: 12px; min-height: 87px; }
  .landing-window-icon { width: 40px; height: 40px; }
  .landing-window-link strong { font-size: 14px; }
  .landing-window-link small { font-size: 10px; }
  .landing-window-caption { font-size: 9px; }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .landing-btn, .landing-window-link, .landing-space-card { transition: none; }
}
</style>
{% endblock %}
{% block content %}
<div class="landing">
  <section class="landing-hero landing-wrap" aria-labelledby="landing-title">
    <div class="landing-hero-copy">
      <p class="landing-kicker">GWANGDEOK / STUDENT COMMUNITY</p>
      <h1 id="landing-title"><span class="title-line">우리 학교의</span><span class="title-line">매일을</span><span class="title-line"><span class="title-highlight">더 가깝게.</span></span></h1>
      <p class="landing-lead">필요한 물건을 나누고, 마음 맞는 동아리를 발견하고, 잃어버린 물건을 함께 찾는 곳. 광덕고 학생들을 위한 새로운 연결을 만들어요.</p>
      <div class="landing-hero-actions">
        <a class="landing-btn" href="{% url 'market' %}">커뮤니티 둘러보기 <span aria-hidden="true">↗</span></a>
        {% if user.is_authenticated %}
          {% if user.student_active %}
            <a class="landing-btn landing-btn-secondary" href="{% url 'me' %}">마이페이지 <span aria-hidden="true">→</span></a>
          {% else %}
            <a class="landing-btn landing-btn-secondary" href="{% url 'invite' %}">학생 인증하기 <span aria-hidden="true">→</span></a>
          {% endif %}
        {% else %}
          <a class="landing-btn landing-btn-secondary" href="{% url 'register' %}">학생으로 시작하기 <span aria-hidden="true">→</span></a>
        {% endif %}
      </div>
      <p class="landing-smallprint">* 학교 공식 서비스가 아닌 학생 주도 비공식 프로젝트이며, 현재 개발 중입니다.</p>
    </div>
    <div class="landing-stage" aria-label="서비스 바로가기">
      <div class="landing-stage-window">
        <div class="landing-window-header">
          <strong>GWG / CAMPUS DESK</strong>
          <span class="landing-window-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        </div>
        <div class="landing-window-title">
          <div><p>MADE FOR OUR DAYS</p><h2>오늘의 학교생활,<br>여기서 시작.</h2></div>
          <span class="landing-spark" aria-hidden="true">✳</span>
        </div>
        <div class="landing-window-list">
          <a class="landing-window-link" href="{% url 'market' %}">
            <span class="landing-window-icon" aria-hidden="true">↗</span>
            <span><strong>Market</strong><small>우리 학교의 작은 거래와 나눔</small></span>
            <span class="landing-window-arrow" aria-hidden="true">↗</span>
          </a>
          <a class="landing-window-link" href="{% url 'clubs' %}">
            <span class="landing-window-icon" aria-hidden="true">✳</span>
            <span><strong>Clubs</strong><small>관심사가 만나는 동아리 공간</small></span>
            <span class="landing-window-arrow" aria-hidden="true">↗</span>
          </a>
          <a class="landing-window-link" href="{% url 'finder' %}">
            <span class="landing-window-icon" aria-hidden="true">⌕</span>
            <span><strong>Finder</strong><small>분실·습득물 정보를 한자리에</small></span>
            <span class="landing-window-arrow" aria-hidden="true">↗</span>
          </a>
        </div>
        <div class="landing-window-caption"><span>ONE SCHOOL. THREE SPACES.</span><span>GWG © 2026</span></div>
      </div>
      <span class="landing-sticker" aria-hidden="true">STUDENT<br>MADE ✦</span>
      <span class="landing-tape" aria-hidden="true"></span>
    </div>
  </section>
  <div class="landing-ribbon" aria-label="커뮤니티 주요 공간">
    <div class="landing-wrap landing-ribbon-inner">
      <span>ONE CAMPUS</span><span class="ribbon-dot" aria-hidden="true">✳</span>
      <span>MARKET</span><span class="ribbon-dot" aria-hidden="true">✳</span>
      <span>CLUBS</span><span class="ribbon-dot" aria-hidden="true">✳</span>
      <span>FINDER</span><span class="ribbon-dot" aria-hidden="true">✳</span>
      <span>YOUR EVERYDAY</span>
    </div>
  </div>
  <section class="landing-section landing-wrap" id="spaces" aria-labelledby="spaces-title">
    <div class="landing-section-top">
      <div><p class="landing-kicker">THREE SPACES / YOUR SCHOOL</p><h2 id="spaces-title">학교생활에 필요한 것,<br>한곳에 모았어요.</h2></div>
      <p>친구들과 더 편하게 연결되는 세 가지 공간을 직접 둘러보세요.</p>
    </div>
    <div class="landing-space-grid">
      <a class="landing-space-card landing-space-market" href="{% url 'market' %}">
        <div class="space-topline"><span>GWG MARKET</span><span class="space-number">01</span></div>
        <div><h3>필요한 건<br>우리끼리.</h3><p>교내에서 물건을 찾고, 나누고, 거래하는 학생 마켓.</p></div>
        <div class="space-illustration" aria-hidden="true"><span class="receipt"></span></div>
        <div class="space-link"><span>마켓 둘러보기</span><span aria-hidden="true">↗</span></div>
      </a>
      <a class="landing-space-card landing-space-clubs" href="{% url 'clubs' %}">
        <div class="space-topline"><span>GWG CLUBS</span><span class="space-number">02</span></div>
        <div><h3>좋아하는 일,<br>함께하자.</h3><p>새로운 동아리와 프로젝트를 발견하는 공간.</p></div>
        <div class="space-illustration" aria-hidden="true"><span class="club-orbit"></span></div>
        <div class="space-link"><span>동아리 찾아보기</span><span aria-hidden="true">↗</span></div>
      </a>
      <a class="landing-space-card landing-space-finder" href="{% url 'finder' %}">
        <div class="space-topline"><span>GWG FINDER</span><span class="space-number">03</span></div>
        <div><h3>잃어버려도,<br>함께 찾자.</h3><p>분실물과 습득물 정보를 모아 찾기 쉽게.</p></div>
        <div class="space-illustration" aria-hidden="true"><span class="finder-lens"></span></div>
        <div class="space-link"><span>파인더 둘러보기</span><span aria-hidden="true">↗</span></div>
      </a>
    </div>
  </section>
  <section class="landing-section landing-how" aria-labelledby="how-title">
    <div class="landing-wrap landing-how-grid">
      <div>
        <p class="landing-kicker">HOW TO JOIN</p>
        <h2 id="how-title">둘러보기는 자유롭게,<br>참여는 학생답게.</h2>
        <p class="how-intro">학생이 함께 만들어가는 공간인 만큼, 게시글 작성과 동아리 참여에는 이메일 확인과 초대 코드 인증이 필요해요.</p>
      </div>
      <ol class="landing-steps">
        <li><span class="step-id">01</span><div><strong>먼저 둘러보세요.</strong><p>마켓, 동아리, 파인더의 공개 콘텐츠를 확인하고 필요한 기능을 찾아보세요.</p></div></li>
        <li><span class="step-id">02</span><div><strong>이메일을 확인해 주세요.</strong><p>회원가입 후 확인 메일의 링크를 열어 계정의 이메일을 인증해 주세요.</p></div></li>
        <li><span class="step-id">03</span><div><strong>초대 코드로 참여하세요.</strong><p>발급받은 일회용 초대 코드를 등록하면 학생 전용 기능에 참여할 수 있어요.</p></div></li>
      </ol>
    </div>
  </section>
  <section class="landing-cta landing-wrap" aria-labelledby="landing-cta-title">
    <div class="landing-cta-panel">
      <div><p class="landing-kicker">BUILT BY STUDENTS</p><h2 id="landing-cta-title">우리 학교의 이야기를<br>함께 만들어 갈까요?</h2><p>GwgCommunity는 학생이 만드는 비공식 학교생활 커뮤니티입니다.</p></div>
      {% if user.is_authenticated %}
        {% if user.student_active %}
          <a class="landing-btn" href="{% url 'me' %}">내 활동 확인하기 <span aria-hidden="true">↗</span></a>
        {% else %}
          <a class="landing-btn" href="{% url 'invite' %}">학생 인증하기 <span aria-hidden="true">↗</span></a>
        {% endif %}
      {% else %}
        <a class="landing-btn" href="{% url 'register' %}">회원가입하기 <span aria-hidden="true">↗</span></a>
      {% endif %}
    </div>
  </section>
</div>
{% endblock %}
"""
