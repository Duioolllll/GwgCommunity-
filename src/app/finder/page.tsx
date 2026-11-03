import Link from "next/link";

const posts = [
  { kind: "습득", title: "검정색 무선 이어폰", place: "본관 2층 복도", date: "11월 2일", tone: "found" },
  { kind: "분실", title: "하늘색 필통", place: "3학년 교실 주변", date: "11월 1일", tone: "lost" },
  { kind: "습득", title: "카드지갑", place: "운동장 스탠드", date: "10월 31일", tone: "found" },
];

export default function FinderPage() {
  return (
    <div className="subpage page-shell">
      <div className="subpage-heading">
        <div>
          <p className="eyebrow">GWG FINDER</p>
          <h1>분실물 찾기</h1>
          <p>잃어버린 물건과 습득물을 안전하게 연결합니다.</p>
        </div>
        <Link className="button button-dark" href="/finder/new">등록하기 <span aria-hidden>↗</span></Link>
      </div>
      <div className="finder-banner"><strong>물건을 찾고 있나요?</strong><span>정확한 위치와 연락처는 공개하지 않습니다. 소유권은 비공개로 확인합니다.</span></div>
      <div className="finder-list">
        {posts.map((post) => (
          <article className="finder-row" key={post.title}>
            <span className={`finder-kind ${post.tone}`}>{post.kind}</span>
            <div><h2>{post.title}</h2><p>{post.place}</p></div>
            <time>{post.date}</time>
            <span className="card-arrow" aria-hidden>↗</span>
          </article>
        ))}
      </div>
      <div className="empty-note">분실·습득물 등록과 유사 물건 추천은 학생 인증 후 이용할 수 있습니다.</div>
    </div>
  );
}
