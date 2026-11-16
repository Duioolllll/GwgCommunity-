// 구현 미반영: 이미지 특징 비교와 매칭 알림 발송은 없다. 규칙 기반 점수는 소유권 증명이 아니다.
/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
/** Rule-based similarity scores are comparison aids, not proof of ownership. */
export type FinderPost = {
  id: string;
  kind: "lost" | "found";
  status: "ACTIVE" | "CLOSED";
  category: string | null;
  color: string | null;
  generalLocation: string | null;
  occurredAt: string | null;
};

// 기능 `normalize`(value): `value?.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase() || ""` 평가 결과를 반환한다.
// 단락 분기 `value?.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase()`: 거짓인 경우에만 오른쪽 `""`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
const normalize = (value: string | null) => value?.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase() || "";

// 유효한 ISO 날짜를 UTC 기준 일수로 바꿔 날짜 차이를 계산한다.
// 기능 `dayNumber`(value): `!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)` 조건을 추가로 검사한다.
function dayNumber(value: string | null): number | null {
  // 조건 `!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)`: 참이면 `null`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!value`: 거짓인 경우에만 오른쪽 `!/^\d{4}-\d{2}-\d{2}$/.test(value)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  // 조건 `!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value`: 참이면 `null`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!Number.isFinite(timestamp)`: 거짓인 경우에만 오른쪽 `new Date(timestamp).toISOString().slice(0, 10) !== value`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return null;
  return timestamp / 86_400_000;
}

// 분류·색상·장소·날짜 점수를 합산하며 소유권 판정에는 사용하지 않는다.
// 기능 `scoreFinderMatch`(a, b): 먼저 `const categoryA = normalize(a.category), categoryB = normalize(b.category);`를 실행한다.
export function scoreFinderMatch(a: FinderPost, b: FinderPost) {
  const categoryA = normalize(a.category), categoryB = normalize(b.category);
  const colorA = normalize(a.color), colorB = normalize(b.color);
  const locationA = normalize(a.generalLocation), locationB = normalize(b.generalLocation);
  // 선택 조건 `categoryA && categoryA === categoryB`: 참이면 `40`, 거짓이면 `0`를 사용한다.
  // 단락 분기 `categoryA`: 참인 경우에만 오른쪽 `categoryA === categoryB`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  const category = categoryA && categoryA === categoryB ? 40 : 0;
  // 선택 조건 `colorA && colorA === colorB`: 참이면 `25`, 거짓이면 `0`를 사용한다.
  // 단락 분기 `colorA`: 참인 경우에만 오른쪽 `colorA === colorB`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  const color = colorA && colorA === colorB ? 25 : 0;
  // Exact area: 20; one area contained in the other: 10; missing/other: 0.
  // 선택 조건 `!locationA || !locationB`: 참이면 `0`, 거짓이면 `locationA === locationB ? 20 : locationA.includes(locationB) || locationB.includes(locationA) ? 10 : 0`를 사용한다.
  // 단락 분기 `!locationA`: 거짓인 경우에만 오른쪽 `!locationB`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 선택 조건 `locationA === locationB`: 참이면 `20`, 거짓이면 `locationA.includes(locationB) || locationB.includes(locationA) ? 10 : 0`를 사용한다.
  // 선택 조건 `locationA.includes(locationB) || locationB.includes(locationA)`: 참이면 `10`, 거짓이면 `0`를 사용한다.
  // 단락 분기 `locationA.includes(locationB)`: 거짓인 경우에만 오른쪽 `locationB.includes(locationA)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  const location = !locationA || !locationB ? 0 : locationA === locationB ? 20 :
    locationA.includes(locationB) || locationB.includes(locationA) ? 10 : 0;
  const dayA = dayNumber(a.occurredAt), dayB = dayNumber(b.occurredAt);
  // 선택 조건 `dayA === null || dayB === null`: 참이면 `Infinity`, 거짓이면 `Math.abs(dayA - dayB)`를 사용한다.
  // 단락 분기 `dayA === null`: 거짓인 경우에만 오른쪽 `dayB === null`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  const difference = dayA === null || dayB === null ? Infinity : Math.abs(dayA - dayB);
  // Calendar days: same day 15, within 3 days 10, within 7 days 5, else 0.
  // 선택 조건 `difference === 0`: 참이면 `15`, 거짓이면 `difference <= 3 ? 10 : difference <= 7 ? 5 : 0`를 사용한다.
  // 선택 조건 `difference <= 3`: 참이면 `10`, 거짓이면 `difference <= 7 ? 5 : 0`를 사용한다.
  // 선택 조건 `difference <= 7`: 참이면 `5`, 거짓이면 `0`를 사용한다.
  const date = difference === 0 ? 15 : difference <= 3 ? 10 : difference <= 7 ? 5 : 0;
  return { category, color, location, date, total: category + color + location + date };
}

// 활성 반대 유형 후보를 중복 제거하고 70점 이상을 점수순으로 제한해 반환한다.
// 기능 `rankFinderMatches`(source, candidates, limit): `!Number.isInteger(limit) || limit < 1 || limit > 100` 조건을 추가로 검사한다.
export function rankFinderMatches<T extends FinderPost>(source: FinderPost, candidates: T[], limit = 20) {
  // 조건 `!Number.isInteger(limit) || limit < 1 || limit > 100`: 참이면 `new RangeError("limit must be an integer from 1 to 100")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!Number.isInteger(limit) || limit < 1`: 거짓인 경우에만 오른쪽 `limit > 100`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!Number.isInteger(limit)`: 거짓인 경우에만 오른쪽 `limit < 1`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError("limit must be an integer from 1 to 100");
  // 조건 `source.status !== "ACTIVE"`: 참이면 `[]`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (source.status !== "ACTIVE") return [];
  const seen = new Set<string>();
  // 기능 `콜백`(candidate): `candidate.id === source.id || candidate.kind === source.kind || candidate.status !== "ACTIVE" || seen.has(candidate.id)` 조건을 추가로 검사한다.
  // 기능 `콜백`(a, b): `b.score.total - a.score.total || a.post.id.localeCompare(b.post.id)` 평가 결과를 반환한다.
  // 단락 분기 `b.score.total - a.score.total`: 거짓인 경우에만 오른쪽 `a.post.id.localeCompare(b.post.id)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  return candidates.flatMap((candidate) => {
    // 조건 `candidate.id === source.id || candidate.kind === source.kind || candidate.status !== "ACTIVE" || seen.has(candidate.id)`: 참이면 `[]`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    // 단락 분기 `candidate.id === source.id || candidate.kind === source.kind || candidate.status !== "ACTIVE"`: 거짓인 경우에만 오른쪽 `seen.has(candidate.id)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    // 단락 분기 `candidate.id === source.id || candidate.kind === source.kind`: 거짓인 경우에만 오른쪽 `candidate.status !== "ACTIVE"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    // 단락 분기 `candidate.id === source.id`: 거짓인 경우에만 오른쪽 `candidate.kind === source.kind`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    if (candidate.id === source.id || candidate.kind === source.kind || candidate.status !== "ACTIVE" || seen.has(candidate.id)) return [];
    seen.add(candidate.id);
    const score = scoreFinderMatch(source, candidate);
    // 선택 조건 `score.total >= 70`: 참이면 `[{ post: candidate, score }]`, 거짓이면 `[]`를 사용한다.
    return score.total >= 70 ? [{ post: candidate, score }] : [];
  }).sort((a, b) => b.score.total - a.score.total || a.post.id.localeCompare(b.post.id)).slice(0, limit);
}
