import Link from "next/link";

const services = [
  {
    number: "01",
    name: "Gwg Market",
    description: "교내에서 안전하게 사고팔고, 나누는 공간",
    href: "/market",
    action: "상품 둘러보기",
  },
  {
    number: "02",
    name: "Gwg Clubs",
    description: "동아리와 학생 프로젝트를 발견하는 공간",
    href: "/clubs",
    action: "동아리 둘러보기",
  },
  {
    number: "03",
    name: "Gwg Finder",
    description: "잃어버린 물건과 습득물을 연결하는 공간",
    href: "/finder",
    action: "분실물 찾아보기",
  },
];

export default function HomePage() {
  return (
    <div>
      <section className="hero page-shell">
        <div className="hero-copy">
          <p className="eyebrow">GWANGDEOK HIGH SCHOOL / STUDENT COMMUNITY</p>
          <h1>
            학교생활에 필요한
            <br />
            연결을 한 곳에서.
          </h1>
          <p className="hero-description">
            거래하고, 활동을 발견하고, 잃어버린 물건을 찾는
            <br className="desktop-only" />
            학생 중심 반개방형 커뮤니티입니다.
          </p>
          <div className="hero-actions">
            <Link className="button button-dark" href="/clubs">
              활동 둘러보기 <span aria-hidden>→</span>
            </Link>
            <Link className="text-link" href="/auth/register">
              초대 코드로 시작하기 <span aria-hidden>↗</span>
            </Link>
          </div>
        </div>
        <div className="hero-note" aria-label="서비스 안내">
          <span>학생이 만들고</span>
          <span>학생이 사용하는</span>
          <span className="note-strong">비공식 프로젝트</span>
        </div>
      </section>

      <section className="services-section page-shell" aria-labelledby="services-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THREE WAYS TO CONNECT</p>
            <h2 id="services-title">필요한 기능을 찾아보세요.</h2>
          </div>
          <p>광덕고 학생들의 일상에 맞춘 세 가지 서비스</p>
        </div>
        <div className="service-grid">
          {services.map((service) => (
            <Link className="service-card" href={service.href} key={service.name}>
              <span className="service-number">{service.number}</span>
              <div>
                <h3>{service.name}</h3>
                <p>{service.description}</p>
              </div>
              <span className="card-arrow" aria-hidden>↗</span>
              <span className="service-action">{service.action}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="notice-section page-shell">
        <div>
          <p className="eyebrow">A SAFE START</p>
          <h2>공개된 정보는 안전하게,<br />학생 전용 기능은 꼼꼼하게.</h2>
        </div>
        <div className="notice-copy">
          <p>동아리와 공개 활동은 누구나 볼 수 있고, 게시글 작성과 지원은 초대 인증을 마친 학생만 이용할 수 있습니다.</p>
          <Link className="text-link" href="/auth/register">가입 방식 알아보기 <span aria-hidden>↗</span></Link>
        </div>
      </section>
    </div>
  );
}
