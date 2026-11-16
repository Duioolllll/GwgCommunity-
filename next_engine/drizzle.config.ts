/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local", quiet: true });

// 로컬 환경의 PostgreSQL 연결과 스키마를 사용해 drizzle 출력 경로를 지정한다.
// 단락 분기 `process.env.DATABASE_URL`: null 또는 undefined인 경우에만 오른쪽 `""`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
