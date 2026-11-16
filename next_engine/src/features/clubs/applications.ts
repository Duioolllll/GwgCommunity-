/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { sql } from "drizzle-orm";
import type { Database } from "@/lib/db/types";

/** Insert only while the recruitment and public club are eligible; uniqueness is enforced by PostgreSQL. */
// 동아리 모집에 대한 지원을 처리한다.
// 기능 `submitApplication`(db, clubId, recruitmentId, applicantId, answer): 먼저 `const result = await db.execute(sql`insert into club_applications (recruitment_id, applicant_id, answers) select r.id, ${applicantId}, ${JSON.stringify({ answer })}::jsonb from club_recruitments r join clubs c on c.id = r.club_id join "user" u on u.id = ${applicantId} where r.id = ${recruitmentId}::uuid and r.club_id = ${clubId}::uuid and c.is_public and u.email_verified and u.status = 'ACTIVE_STUDENT' and r.is_open and r.opens_at <= now() and r.closes_at > now() on conflict (recruitment_id, applicant_id) do nothing returning id`);`를 실행한다.
export async function submitApplication(db: Database, clubId: string, recruitmentId: string, applicantId: string, answer: string) {
  const result = await db.execute(sql`insert into club_applications (recruitment_id, applicant_id, answers)
    select r.id, ${applicantId}, ${JSON.stringify({ answer })}::jsonb from club_recruitments r
    join clubs c on c.id = r.club_id
    join "user" u on u.id = ${applicantId}
    where r.id = ${recruitmentId}::uuid and r.club_id = ${clubId}::uuid and c.is_public
      and u.email_verified and u.status = 'ACTIVE_STUDENT'
      and r.is_open and r.opens_at <= now() and r.closes_at > now()
    on conflict (recruitment_id, applicant_id) do nothing returning id`);
  return result.rows.length > 0;
}
