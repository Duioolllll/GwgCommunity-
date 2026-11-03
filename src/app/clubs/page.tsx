import Link from "next/link";

const clubs = [
  { name: "GDSC Gwangdeok", category: "IT·개발", description: "기술로 학교의 문제를 해결하는 학생 개발 커뮤니티", members: "12명", recruiting: true },
  { name: "광덕 영상 제작소", category: "예술·미디어", description: "카메라와 편집으로 우리의 이야기를 기록합니다.", members: "8명", recruiting: true },
  { name: "책과 사람들", category: "인문·사회", description: "한 달에 한 권, 함께 읽고 깊이 이야기합니다.", members: "15명", recruiting: false },
];

export default function ClubsPage() {
  return (
    <div className="subpage page-shell">
      <div className="subpage-heading">
        <div>
          <p className="eyebrow">GWG CLUBS</p>
          <h1>동아리와 활동</h1>
          <p>광덕고에서 진행되는 다양한 활동을 발견해보세요.</p>
        </div>
        <Link className="text-link" href="/auth/login">운영자 로그인 <span aria-hidden>↗</span></Link>
      </div>
      <div className="filter-row">
        <button className="filter-chip active">전체 동아리</button>
        <button className="filter-chip">모집 중</button>
        <button className="filter-chip">IT·개발</button>
        <button className="filter-chip">예술·미디어</button>
      </div>
      <div className="club-list">
        {clubs.map((club) => (
          <article className="club-row" key={club.name}>
            <div className="club-avatar" aria-hidden>{club.name.charAt(0)}</div>
            <div className="club-info"><span className="card-label">{club.category}</span><h2>{club.name}</h2><p>{club.description}</p></div>
            <div className="club-status">{club.recruiting ? <span className="status-open">모집 중</span> : <span>멤버 {club.members}</span>}</div>
            <span className="card-arrow" aria-hidden>↗</span>
          </article>
        ))}
      </div>
    </div>
  );
}
