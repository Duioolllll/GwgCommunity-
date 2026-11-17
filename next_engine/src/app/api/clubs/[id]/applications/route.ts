import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { clubApplications, clubRecruitments, user } from "@/lib/db/schema";
import { submitApplication } from "@/features/clubs/applications";
import { authorizeClub } from "@/app/clubs/authorization";
import { errorResponse, jsonBody } from "@/lib/api";

// 본인 지원 내역 또는 운영자용 지원 목록을 불러온다.
// 조회 요청을 받아 동아리 처리를 하고 결과를 돌려준다.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeClub((await params).id);
  // 확인할 조건: auth의 오류 있음 또는 true. 해당하면 auth의 오류을 돌려준다.
  if (auth.error) return auth.error;
  if (new URL(request.url).searchParams.get("mine") === "1") {
    const applications = await getDb().select({ recruitmentId: clubApplications.recruitmentId, status: clubApplications.status }).from(clubApplications).innerJoin(clubRecruitments, eq(clubApplications.recruitmentId, clubRecruitments.id)).where(sql`${clubRecruitments.clubId} = ${auth.club.id} and ${clubApplications.applicantId} = ${auth.viewer.id}`);
    return NextResponse.json({ applications });
  }
  // 확인할 조건: auth의 운영자 여부 없음 또는 false. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!auth.manager) return errorResponse("FORBIDDEN", "동아리 운영자 권한이 필요합니다.", 403);
  const applications = await getDb().select({ id: clubApplications.id, recruitmentTitle: clubRecruitments.title, applicantName: user.name, answers: clubApplications.answers, status: clubApplications.status, createdAt: clubApplications.createdAt }).from(clubApplications).innerJoin(clubRecruitments, eq(clubApplications.recruitmentId, clubRecruitments.id)).innerJoin(user, eq(clubApplications.applicantId, user.id)).where(eq(clubRecruitments.clubId, auth.club.id)).limit(100);
  return NextResponse.json({ applications });
}

// 모집 공고와 지원 내용을 검증하고 지원을 접수한다.
// 등록 요청을 받아 동아리 처리를 하고 결과를 돌려준다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeClub((await params).id);
  // 확인할 조건: auth의 오류 있음 또는 true. 해당하면 auth의 오류을 돌려준다.
  if (auth.error) return auth.error;
  // request의 요청에 붙은 부가 정보에서 찾은 “content-type”이 비어 있으면 빈 글자를 대신 사용한다.
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return errorResponse("INVALID_INPUT", "JSON 요청이 필요합니다.", 415);
  const body = await jsonBody(request);
  const recruitmentId = body?.recruitmentId;
  const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
  // 입력값의 자료형이 이 코드에서 요구하는 형식인지 확인한다. 맞지 않는 값은 아래 처리에서 제외한다.
  if (typeof recruitmentId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recruitmentId) || !answer || answer.length > 2000) return errorResponse("INVALID_INPUT", "모집 공고와 지원 내용을 확인하세요. (최대 2000자)", 400);
  const submitted = await submitApplication(getDb(), auth.club.id, recruitmentId, auth.viewer.id, answer);
  // 확인할 조건: submitted 없음 또는 false. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!submitted) return errorResponse("CLOSED_OR_DUPLICATE", "모집 기간이 아니거나 이미 지원한 공고입니다.", 409);
  return NextResponse.json({ ok: true }, { status: 201 });
}

// 운영자가 지원 상태를 변경한다.
// 수정 요청을 받아 동아리 처리를 하고 결과를 돌려준다.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeClub((await params).id);
  // 확인할 조건: auth의 오류 있음 또는 true. 해당하면 auth의 오류을 돌려준다.
  if (auth.error) return auth.error;
  // 확인할 조건: auth의 운영자 여부 없음 또는 false. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!auth.manager) return errorResponse("FORBIDDEN", "동아리 운영자 권한이 필요합니다.", 403);
  const body = await jsonBody(request);
  const id = body?.applicationId;
  const status = body?.status;
  // 입력값의 자료형이 이 코드에서 요구하는 형식인지 확인한다. 맞지 않는 값은 아래 처리에서 제외한다.
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || (status !== "IN_REVIEW" && status !== "ACCEPTED" && status !== "REJECTED")) return errorResponse("INVALID_INPUT", "신청 상태를 확인하세요.", 400);
  const result = await getDb().execute(sql`update club_applications a set status = ${status}::application_status from club_recruitments r where a.id = ${id}::uuid and a.recruitment_id = r.id and r.club_id = ${auth.club.id}::uuid and a.status <> 'CANCELLED' returning a.id`);
  // 확인할 조건: 처리 결과의 rows의 개수 또는 길이 없음 또는 false. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!result.rows.length) return errorResponse("NOT_FOUND", "신청서를 찾을 수 없습니다.", 404);
  return NextResponse.json({ ok: true });
}
