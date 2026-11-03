import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { clubApplications, clubRecruitments, user } from "@/lib/db/schema";
import { submitApplication } from "@/features/clubs/applications";
import { authorizeClub } from "@/app/clubs/authorization";
import { errorResponse, jsonBody } from "@/lib/api";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeClub((await params).id);
  if (auth.error) return auth.error;
  if (new URL(request.url).searchParams.get("mine") === "1") {
    const applications = await getDb().select({ recruitmentId: clubApplications.recruitmentId, status: clubApplications.status }).from(clubApplications).innerJoin(clubRecruitments, eq(clubApplications.recruitmentId, clubRecruitments.id)).where(sql`${clubRecruitments.clubId} = ${auth.club.id} and ${clubApplications.applicantId} = ${auth.viewer.id}`);
    return NextResponse.json({ applications });
  }
  if (!auth.manager) return errorResponse("FORBIDDEN", "동아리 운영자 권한이 필요합니다.", 403);
  const applications = await getDb().select({ id: clubApplications.id, recruitmentTitle: clubRecruitments.title, applicantName: user.name, answers: clubApplications.answers, status: clubApplications.status, createdAt: clubApplications.createdAt }).from(clubApplications).innerJoin(clubRecruitments, eq(clubApplications.recruitmentId, clubRecruitments.id)).innerJoin(user, eq(clubApplications.applicantId, user.id)).where(eq(clubRecruitments.clubId, auth.club.id)).limit(100);
  return NextResponse.json({ applications });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeClub((await params).id);
  if (auth.error) return auth.error;
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return errorResponse("INVALID_INPUT", "JSON 요청이 필요합니다.", 415);
  const body = await jsonBody(request);
  const recruitmentId = body?.recruitmentId;
  const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
  if (typeof recruitmentId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recruitmentId) || !answer || answer.length > 2000) return errorResponse("INVALID_INPUT", "모집 공고와 지원 내용을 확인하세요. (최대 2000자)", 400);
  const submitted = await submitApplication(getDb(), auth.club.id, recruitmentId, auth.viewer.id, answer);
  if (!submitted) return errorResponse("CLOSED_OR_DUPLICATE", "모집 기간이 아니거나 이미 지원한 공고입니다.", 409);
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeClub((await params).id);
  if (auth.error) return auth.error;
  if (!auth.manager) return errorResponse("FORBIDDEN", "동아리 운영자 권한이 필요합니다.", 403);
  const body = await jsonBody(request);
  const id = body?.applicationId;
  const status = body?.status;
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || (status !== "IN_REVIEW" && status !== "ACCEPTED" && status !== "REJECTED")) return errorResponse("INVALID_INPUT", "신청 상태를 확인하세요.", 400);
  const result = await getDb().execute(sql`update club_applications a set status = ${status}::application_status from club_recruitments r where a.id = ${id}::uuid and a.recruitment_id = r.id and r.club_id = ${auth.club.id}::uuid and a.status <> 'CANCELLED' returning a.id`);
  if (!result.rows.length) return errorResponse("NOT_FOUND", "신청서를 찾을 수 없습니다.", 404);
  return NextResponse.json({ ok: true });
}
