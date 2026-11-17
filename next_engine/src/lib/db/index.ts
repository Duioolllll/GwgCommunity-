import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// 앱을 빌드할 때는 데이터베이스 연결을 만들지 않는다. 실제 자료를 읽으려 할 때 연결 설정을 확인한다.
const databaseUrl = process.env.DATABASE_URL;
let connection: ReturnType<typeof drizzle<typeof schema>> | undefined;

// 환경변수의 연결 주소로 최대 다섯 연결의 풀을 지연 생성하고 재사용한다.
// PostgreSQL 데이터베이스에 연결하는 도구를 필요할 때 한 번 만들고 다시 사용한다.
export function getDb() {
  // PostgreSQL 연결 주소를 설정하지 않았다면 자료를 읽거나 저장할 수 없다고 알린다.
  if (!databaseUrl) throw new Error("DATABASE_URL is required to access PostgreSQL");
  connection ??= drizzle(new Pool({ connectionString: databaseUrl, max: 5 }), { schema });
  return connection;
}
