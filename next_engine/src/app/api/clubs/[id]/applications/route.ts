/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { clubApplications, clubRecruitments, user } from "@/lib/db/schema";
import { submitApplication } from "@/features/clubs/applications";
import { authorizeClub } from "@/app/clubs/authorization";
import { errorResponse, jsonBody } from "@/lib/api";

// 본인 지원 내역 또는 운영자용 지원 목록을 조회한다.
// 기능 `GET`(request, { params }): 먼저 `const auth = await authorizeClub((await params).id);`를 실행한다.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeClub((await params).id);
  // 조건 `auth.error`: 참이면 `auth.error`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (auth.error) return auth.error;
  // 조건 `new URL(request.url).searchParams.get("mine") === "1"`: 참이면 먼저 `const applications = await getDb().select({ recruitmentId: clubApplications.recruitmentId, status: clubApplications.status }).from(clubApplications).innerJoin(clubRecruitments, eq(clubApplications.recruitmentId, clubRecruitments.id)).where(sql`${clubRecruitments.clubId} = ${auth.club.id} and ${clubApplications.applicantId} = ${auth.viewer.id}`);`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (new URL(request.url).searchParams.get("mine") === "1") {
    const applications = await getDb().select({ recruitmentId: clubApplications.recruitmentId, status: clubApplications.status }).from(clubApplications).innerJoin(clubRecruitments, eq(clubApplications.recruitmentId, clubRecruitments.id)).where(sql`${clubRecruitments.clubId} = ${auth.club.id} and ${clubApplications.applicantId} = ${auth.viewer.id}`);
    return NextResponse.json({ applications });
  }
  // 조건 `!auth.manager`: 참이면 `errorResponse("FORBIDDEN", "동아리 운영자 권한이 필요합니다.", 403)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!auth.manager) return errorResponse("FORBIDDEN", "동아리 운영자 권한이 필요합니다.", 403);
  const applications = await getDb().select({ id: clubApplications.id, recruitmentTitle: clubRecruitments.title, applicantName: user.name, answers: clubApplications.answers, status: clubApplications.status, createdAt: clubApplications.createdAt }).from(clubApplications).innerJoin(clubRecruitments, eq(clubApplications.recruitmentId, clubRecruitments.id)).innerJoin(user, eq(clubApplications.applicantId, user.id)).where(eq(clubRecruitments.clubId, auth.club.id)).limit(100);
  return NextResponse.json({ applications });
}

// 모집 공고와 지원 내용을 검증하고 지원을 접수한다.
// 기능 `POST`(request, { params }): 먼저 `const auth = await authorizeClub((await params).id);`를 실행한다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeClub((await params).id);
  // 조건 `auth.error`: 참이면 `auth.error`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (auth.error) return auth.error;
  // 조건 `!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")`: 참이면 `errorResponse("INVALID_INPUT", "JSON 요청이 필요합니다.", 415)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `request.headers.get("content-type")`: null 또는 undefined인 경우에만 오른쪽 `""`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return errorResponse("INVALID_INPUT", "JSON 요청이 필요합니다.", 415);
  const body = await jsonBody(request);
  const recruitmentId = body?.recruitmentId;
  // 선택 조건 `typeof body?.answer === "string"`: 참이면 `body.answer.trim()`, 거짓이면 `""`를 사용한다.
  const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
  // 조건 `typeof recruitmentId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recruitmentId) || !answer || answer.length > 2000`: 참이면 `errorResponse("INVALID_INPUT", "모집 공고와 지원 내용을 확인하세요. (최대 2000자)", 400)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `typeof recruitmentId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recruitmentId) || !answer`: 거짓인 경우에만 오른쪽 `answer.length > 2000`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `typeof recruitmentId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recruitmentId)`: 거짓인 경우에만 오른쪽 `!answer`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `typeof recruitmentId !== "string"`: 거짓인 경우에만 오른쪽 `!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recruitmentId)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (typeof recruitmentId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recruitmentId) || !answer || answer.length > 2000) return errorResponse("INVALID_INPUT", "모집 공고와 지원 내용을 확인하세요. (최대 2000자)", 400);
  const submitted = await submitApplication(getDb(), auth.club.id, recruitmentId, auth.viewer.id, answer);
  // 조건 `!submitted`: 참이면 `errorResponse("CLOSED_OR_DUPLICATE", "모집 기간이 아니거나 이미 지원한 공고입니다.", 409)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!submitted) return errorResponse("CLOSED_OR_DUPLICATE", "모집 기간이 아니거나 이미 지원한 공고입니다.", 409);
  return NextResponse.json({ ok: true }, { status: 201 });
}

// 운영자가 지원 상태를 변경한다.
// 기능 `PATCH`(request, { params }): 먼저 `const auth = await authorizeClub((await params).id);`를 실행한다.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeClub((await params).id);
  // 조건 `auth.error`: 참이면 `auth.error`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (auth.error) return auth.error;
  // 조건 `!auth.manager`: 참이면 `errorResponse("FORBIDDEN", "동아리 운영자 권한이 필요합니다.", 403)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!auth.manager) return errorResponse("FORBIDDEN", "동아리 운영자 권한이 필요합니다.", 403);
  const body = await jsonBody(request);
  const id = body?.applicationId;
  const status = body?.status;
  // 조건 `typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || (status !== "IN_REVIEW" && status !== "ACCEPTED" && status !== "REJECTED")`: 참이면 `errorResponse("INVALID_INPUT", "신청 상태를 확인하세요.", 400)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)`: 거짓인 경우에만 오른쪽 `(status !== "IN_REVIEW" && status !== "ACCEPTED" && status !== "REJECTED")`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `typeof id !== "string"`: 거짓인 경우에만 오른쪽 `!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `status !== "IN_REVIEW" && status !== "ACCEPTED"`: 참인 경우에만 오른쪽 `status !== "REJECTED"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `status !== "IN_REVIEW"`: 참인 경우에만 오른쪽 `status !== "ACCEPTED"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || (status !== "IN_REVIEW" && status !== "ACCEPTED" && status !== "REJECTED")) return errorResponse("INVALID_INPUT", "신청 상태를 확인하세요.", 400);
  const result = await getDb().execute(sql`update club_applications a set status = ${status}::application_status from club_recruitments r where a.id = ${id}::uuid and a.recruitment_id = r.id and r.club_id = ${auth.club.id}::uuid and a.status <> 'CANCELLED' returning a.id`);
  // 조건 `!result.rows.length`: 참이면 `errorResponse("NOT_FOUND", "신청서를 찾을 수 없습니다.", 404)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!result.rows.length) return errorResponse("NOT_FOUND", "신청서를 찾을 수 없습니다.", 404);
  return NextResponse.json({ ok: true });
}
