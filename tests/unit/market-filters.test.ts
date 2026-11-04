import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFilters } from "../../src/features/market/data";

test("Market filters accept repeated URL parameters without failing the page", () => {
  assert.deepEqual(parseFilters({ q: ["  교재  ", "ignored"], category: ["책·교재", "기타"], status: ["AVAILABLE", "COMPLETED"], minPrice: ["1000", "2000"], maxPrice: ["9000"], page: ["2", "3"] }), {
    q: "교재", category: "책·교재", status: "AVAILABLE", minPrice: 1000, maxPrice: 9000, page: 2,
  });
  assert.deepEqual(parseFilters({ q: [], page: [], minPrice: [] }), parseFilters({}));
});
