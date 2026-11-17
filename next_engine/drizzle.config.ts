import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local", quiet: true });

// 로컬 환경의 PostgreSQL 연결과 스키마를 사용해 drizzle 출력 경로를 지정한다.
// process의 env의 DATABASE_URL이 비어 있으면 빈 글자를 대신 사용한다.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
