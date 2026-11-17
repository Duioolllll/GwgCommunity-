import { test } from "node:test";
import assert from "node:assert/strict";
import { rankFinderMatches, scoreFinderMatch, type FinderPost } from "../../src/features/finder/matching";

const lost: FinderPost = { id: "lost", kind: "lost", status: "ACTIVE", category: "지갑", color: "검정", generalLocation: "본관 2층", occurredAt: "2026-11-03" };
// 기본 분실물 자료에 테스트에서 바꿀 항목만 덮어써 비교용 글을 만든다.
const found = (patch: Partial<FinderPost> = {}): FinderPost => ({ ...lost, id: "found", kind: "found", ...patch });

// 이름에 적힌 상황에서 결과가 예상대로 나오는지 확인하는 테스트다.
test("full score, normalized comparisons and partial location", () => {
  assert.equal(scoreFinderMatch(lost, found({ category: " 지갑 ", generalLocation: "본관  2층" })).total, 100);
  assert.equal(scoreFinderMatch(lost, found({ generalLocation: "본관" })).location, 10);
});
// 이름에 적힌 상황에서 결과가 예상대로 나오는지 확인하는 테스트다.
test("missing or invalid values never match each other", () => {
  const blank = { ...lost, category: "", color: "", generalLocation: null, occurredAt: null };
  assert.equal(scoreFinderMatch(blank, found({ category: "", color: "", generalLocation: null, occurredAt: null })).total, 0);
  assert.equal(scoreFinderMatch(lost, found({ occurredAt: "2026-02-30" })).date, 0);
});
// 이름에 적힌 상황에서 결과가 예상대로 나오는지 확인하는 테스트다.
test("date brackets use calendar days in both directions", () => {
  // 항목 목록의 항목을 하나씩 꺼내 아래 작업을 반복한다. 항목이 없으면 건너뛴다.
  for (const [date, expected] of [["2026-11-03", 15], ["2026-10-31", 10], ["2026-11-06", 10], ["2026-11-07", 5], ["2026-11-10", 5], ["2026-11-11", 0]] as const) {
    assert.equal(scoreFinderMatch(lost, found({ occurredAt: date })).date, expected);
  }
});
// 이름에 적힌 상황에서 결과가 예상대로 나오는지 확인하는 테스트다.
test("threshold includes 70, excludes 69 or less and color alone", () => {
  const at70 = found({ id: "70", generalLocation: null, occurredAt: "2026-11-07" });
  const below = found({ id: "65", generalLocation: null, occurredAt: null });
  const colorOnly = found({ id: "25", category: "우산", generalLocation: null, occurredAt: null });
  // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
  assert.deepEqual(rankFinderMatches(lost, [below, at70, colorOnly]).map(x => x.post.id), ["70"]);
});
// 이름에 적힌 상황에서 결과가 예상대로 나오는지 확인하는 테스트다.
test("filters closed, same id and kind, deduplicates and sorts with stable ties", () => {
  const candidates = [found({ id: "b" }), found({ id: "a" }), found({ id: "a" }), found({ id: "closed", status: "CLOSED" }), found({ id: "lost" }), found({ id: "same-kind", kind: "lost" }), found({ id: "lower", occurredAt: null })];
  // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
  assert.deepEqual(rankFinderMatches(lost, candidates).map(x => x.post.id), ["a", "b", "lower"]);
  assert.deepEqual(rankFinderMatches({ ...lost, status: "CLOSED" }, candidates), []);
  assert.equal(rankFinderMatches(lost, candidates, 1).length, 1);
  // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
  assert.throws(() => rankFinderMatches(lost, candidates, 0), RangeError);
});
