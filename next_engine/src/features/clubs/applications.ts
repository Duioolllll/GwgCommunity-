import { sql } from "drizzle-orm";
import type { Database } from "@/lib/db/types";

/** 공개 동아리에서 모집 중인 공고에만 지원할 수 있다. 중복 지원은 데이터베이스에서도 막는다. */
// 동아리 모집에 대한 지원을 처리한다.
// 학생 자격·모집 기간·중복 지원 여부를 확인하고 지원서를 저장한다.
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
