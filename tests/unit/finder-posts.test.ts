import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFinderFilters, parseFinderInput } from "../../src/features/finder/posts";

const valid = { kind: "lost", title: " 지갑 ", category: "잡화", color: "검정", generalLocation: "본관", occurredAt: "2026-11-03" };
test("validates Finder post input and actual calendar dates", () => {
  assert.equal(parseFinderInput(valid)?.title, "지갑");
  for (const invalid of [null, { ...valid, kind: "other" }, { ...valid, title: " " }, { ...valid, category: "x".repeat(51) }, { ...valid, occurredAt: "2026-02-30" }, { ...valid, occurredAt: "2026-1-01" }]) assert.equal(parseFinderInput(invalid), null);
});

test("validates and normalizes Finder URL filters", () => {
  assert.deepEqual(parseFinderFilters(new URLSearchParams("kind=lost&category=%20%EB%AC%B8%EA%B5%AC%20&color=%EA%B2%80%EC%A0%95&q=book&page=2")),
    { page: 2, kind: "lost", category: "문구", color: "검정", q: "book" });
  for (const search of ["page=0", "page=1.5", "page=10001", "kind=other", `q=${"x".repeat(121)}`]) {
    assert.equal(parseFinderFilters(new URLSearchParams(search)), null);
  }
});
