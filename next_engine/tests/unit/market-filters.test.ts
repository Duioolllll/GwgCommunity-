/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFilters } from "../../src/features/market/data";

// 기능 `콜백`(): 먼저 `assert.deepEqual(parseFilters({ q: [" 교재 ", "ignored"], category: ["책·교재", "기타"], status: ["AVAILABLE", "COMPLETED"], minPrice: ["1000", "2000"], maxPrice: ["9000"], page: ["2", "3"] }), { q: "교재", category: "책·교재", status: "AVAILABLE", minPrice: 1000, maxPrice: 9000, page: 2, });`를 실행한다.
test("Market filters accept repeated URL parameters without failing the page", () => {
  assert.deepEqual(parseFilters({ q: ["  교재  ", "ignored"], category: ["책·교재", "기타"], status: ["AVAILABLE", "COMPLETED"], minPrice: ["1000", "2000"], maxPrice: ["9000"], page: ["2", "3"] }), {
    q: "교재", category: "책·교재", status: "AVAILABLE", minPrice: 1000, maxPrice: 9000, page: 2,
  });
  assert.deepEqual(parseFilters({ q: [], page: [], minPrice: [] }), parseFilters({}));
});
