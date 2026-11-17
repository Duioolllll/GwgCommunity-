// 구현 미반영: 이미지 특징 비교와 매칭 알림 발송은 없다. 비교 점수가 높아도 실제 주인임을 보장하지 않는다.
/** 이 점수는 비슷한 물건을 찾는 참고 자료다. 점수가 높아도 실제 주인이라는 뜻은 아니다. */
export type FinderPost = {
  id: string;
  kind: "lost" | "found";
  status: "ACTIVE" | "CLOSED";
  category: string | null;
  color: string | null;
  generalLocation: string | null;
  occurredAt: string | null;
};

// 글자 표기와 띄어쓰기를 정리하고, 값이 없으면 빈 글자로 처리한다.
const normalize = (value: string | null) => value?.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase() || "";

// 유효한 ISO 날짜를 UTC 기준 일수로 바꿔 날짜 차이를 계산한다.
// 날짜가 올바른지 확인하고 날짜 사이의 차이를 계산할 수 있는 숫자로 바꾼다.
function dayNumber(value: string | null): number | null {
  // 날짜가 비어 있거나 연-월-일 형식이 아니면 올바른 날짜로 사용하지 않는다.
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  // 숫자로 바꿀 수 없는 날짜나 2월 30일처럼 실제로 없는 날짜는 제외한다.
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return null;
  return timestamp / 86_400_000;
}

// 분류·색상·장소·날짜 점수를 합산하며 소유권 판정에는 사용하지 않는다.
// 분류·색상·장소·날짜가 얼마나 비슷한지 점수를 매긴다.
export function scoreFinderMatch(a: FinderPost, b: FinderPost) {
  const categoryA = normalize(a.category), categoryB = normalize(b.category);
  const colorA = normalize(a.color), colorB = normalize(b.color);
  const locationA = normalize(a.generalLocation), locationB = normalize(b.generalLocation);
  // 두 글에 분류 정보가 있고 서로 같으면 40점, 그 외에는 0점이다.
  const category = categoryA && categoryA === categoryB ? 40 : 0;
  // 두 글에 색상 정보가 있고 서로 같으면 25점, 그 외에는 0점이다.
  const color = colorA && colorA === colorB ? 25 : 0;
  // 장소가 비어 있으면 0점, 완전히 같으면 20점, 장소 이름이 일부 겹치면 10점, 그 외에는 0점이다.
  const location = !locationA || !locationB ? 0 : locationA === locationB ? 20 :
    locationA.includes(locationB) || locationB.includes(locationA) ? 10 : 0;
  const dayA = dayNumber(a.occurredAt), dayB = dayNumber(b.occurredAt);
  // 두 날짜가 모두 있을 때만 차이를 구한다. 날짜가 빠졌으면 날짜 점수를 받을 수 없도록 처리한다.
  const difference = dayA === null || dayB === null ? Infinity : Math.abs(dayA - dayB);
  // 같은 날은 15점, 3일 이내는 10점, 7일 이내는 5점, 그보다 멀면 0점이다.
  const date = difference === 0 ? 15 : difference <= 3 ? 10 : difference <= 7 ? 5 : 0;
  return { category, color, location, date, total: category + color + location + date };
}

// 활성 반대 유형 후보를 중복 제거하고 70점 이상을 점수순으로 제한해 반환한다.
// 반대 종류의 글 중 70점 이상인 후보를 골라 점수가 높은 순서로 보여준다.
export function rankFinderMatches<T extends FinderPost>(source: FinderPost, candidates: T[], limit = 20) {
  // 추천 개수는 1개부터 100개 사이의 정수만 허용한다.
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError("limit must be an integer from 1 to 100");
  // 이미 종료한 글에는 추천 후보를 보여주지 않는다.
  if (source.status !== "ACTIVE") return [];
  const seen = new Set<string>();
  // 후보를 하나씩 확인한 뒤 점수가 높은 순으로 정렬한다. 동점이면 글 번호순으로 정하고 최대 개수까지만 남긴다.
  return candidates.flatMap((candidate) => {
    // 자기 글, 같은 분실·습득 종류, 종료된 글, 이미 확인한 글은 추천 목록에서 뺀다.
    if (candidate.id === source.id || candidate.kind === source.kind || candidate.status !== "ACTIVE" || seen.has(candidate.id)) return [];
    seen.add(candidate.id);
    const score = scoreFinderMatch(source, candidate);
    // 합계가 70점 이상인 후보만 남기고 그보다 낮으면 목록에서 뺀다.
    return score.total >= 70 ? [{ post: candidate, score }] : [];
  }).sort((a, b) => b.score.total - a.score.total || a.post.id.localeCompare(b.post.id)).slice(0, limit);
}
