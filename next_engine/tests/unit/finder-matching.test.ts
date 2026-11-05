import { test } from "node:test";
import assert from "node:assert/strict";
import { rankFinderMatches, scoreFinderMatch, type FinderPost } from "../../src/features/finder/matching";

const lost: FinderPost = { id: "lost", kind: "lost", status: "ACTIVE", category: "지갑", color: "검정", generalLocation: "본관 2층", occurredAt: "2026-11-03" };
const found = (patch: Partial<FinderPost> = {}): FinderPost => ({ ...lost, id: "found", kind: "found", ...patch });

test("full score, normalized comparisons and partial location", () => {
  assert.equal(scoreFinderMatch(lost, found({ category: " 지갑 ", generalLocation: "본관  2층" })).total, 100);
  assert.equal(scoreFinderMatch(lost, found({ generalLocation: "본관" })).location, 10);
});
test("missing or invalid values never match each other", () => {
  const blank = { ...lost, category: "", color: "", generalLocation: null, occurredAt: null };
  assert.equal(scoreFinderMatch(blank, found({ category: "", color: "", generalLocation: null, occurredAt: null })).total, 0);
  assert.equal(scoreFinderMatch(lost, found({ occurredAt: "2026-02-30" })).date, 0);
});
test("date brackets use calendar days in both directions", () => {
  for (const [date, expected] of [["2026-11-03", 15], ["2026-10-31", 10], ["2026-11-06", 10], ["2026-11-07", 5], ["2026-11-10", 5], ["2026-11-11", 0]] as const) {
    assert.equal(scoreFinderMatch(lost, found({ occurredAt: date })).date, expected);
  }
});
test("threshold includes 70, excludes 69 or less and color alone", () => {
  const at70 = found({ id: "70", generalLocation: null, occurredAt: "2026-11-07" });
  const below = found({ id: "65", generalLocation: null, occurredAt: null });
  const colorOnly = found({ id: "25", category: "우산", generalLocation: null, occurredAt: null });
  assert.deepEqual(rankFinderMatches(lost, [below, at70, colorOnly]).map(x => x.post.id), ["70"]);
});
test("filters closed, same id and kind, deduplicates and sorts with stable ties", () => {
  const candidates = [found({ id: "b" }), found({ id: "a" }), found({ id: "a" }), found({ id: "closed", status: "CLOSED" }), found({ id: "lost" }), found({ id: "same-kind", kind: "lost" }), found({ id: "lower", occurredAt: null })];
  assert.deepEqual(rankFinderMatches(lost, candidates).map(x => x.post.id), ["a", "b", "lower"]);
  assert.deepEqual(rankFinderMatches({ ...lost, status: "CLOSED" }, candidates), []);
  assert.equal(rankFinderMatches(lost, candidates, 1).length, 1);
  assert.throws(() => rankFinderMatches(lost, candidates, 0), RangeError);
});
