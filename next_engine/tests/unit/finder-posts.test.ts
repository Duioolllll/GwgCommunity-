/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFinderFilters, parseFinderInput } from "../../src/features/finder/posts";

const valid = { kind: "lost", title: " 지갑 ", category: "잡화", color: "검정", generalLocation: "본관", occurredAt: "2026-11-03" };
// 기능 `콜백`(): 먼저 `assert.equal(parseFinderInput(valid)?.title, "지갑");`를 실행한다.
test("validates Finder post input and actual calendar dates", () => {
  assert.equal(parseFinderInput(valid)?.title, "지갑");
  // 반복 `[null, { ...valid, kind: "other" }, { ...valid, title: " " }, { ...valid, category: "x".repeat(51) }, { ...valid, occurredAt: "2026-02-30" }, { ...valid, occurredAt: "2026-1-01" }]`: 각 값를 `const invalid`에 바인딩한다. 대상이 비었으면 본문을 건너뛴다.
  for (const invalid of [null, { ...valid, kind: "other" }, { ...valid, title: " " }, { ...valid, category: "x".repeat(51) }, { ...valid, occurredAt: "2026-02-30" }, { ...valid, occurredAt: "2026-1-01" }]) assert.equal(parseFinderInput(invalid), null);
});

// 기능 `콜백`(): 먼저 `assert.deepEqual(parseFinderFilters(new URLSearchParams("kind=lost&category=%20%EB%AC%B8%EA%B5%AC%20&color=%EA%B2%80%EC%A0%95&q=book&page=2")), { page: 2, kind: "lost", category: "문구", color: "검정", q: "book" });`를 실행한다.
test("validates and normalizes Finder URL filters", () => {
  assert.deepEqual(parseFinderFilters(new URLSearchParams("kind=lost&category=%20%EB%AC%B8%EA%B5%AC%20&color=%EA%B2%80%EC%A0%95&q=book&page=2")),
    { page: 2, kind: "lost", category: "문구", color: "검정", q: "book" });
  // 반복 `["page=0", "page=1.5", "page=10001", "kind=other", `q=${"x".repeat(121)}`]`: 각 값를 `const search`에 바인딩한다. 대상이 비었으면 본문을 건너뛴다.
  for (const search of ["page=0", "page=1.5", "page=10001", "kind=other", `q=${"x".repeat(121)}`]) {
    assert.equal(parseFinderFilters(new URLSearchParams(search)), null);
  }
});
