/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Do not connect during builds; fail explicitly when an actual query is attempted.
const databaseUrl = process.env.DATABASE_URL;
let connection: ReturnType<typeof drizzle<typeof schema>> | undefined;

// 환경변수의 연결 주소로 최대 다섯 연결의 풀을 지연 생성하고 재사용한다.
// 기능 `getDb`(): `!databaseUrl` 조건을 추가로 검사한다.
export function getDb() {
  // 조건 `!databaseUrl`: 참이면 `new Error("DATABASE_URL is required to access PostgreSQL")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!databaseUrl) throw new Error("DATABASE_URL is required to access PostgreSQL");
  connection ??= drizzle(new Pool({ connectionString: databaseUrl, max: 5 }), { schema });
  return connection;
}
