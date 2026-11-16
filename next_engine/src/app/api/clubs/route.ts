/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { NextResponse } from "next/server";
import { listClubs } from "@/app/clubs/data";

// 공개 동아리 목록을 조회한다.
// 기능 `GET`(): `NextResponse.json({ clubs: await listClubs() })`를 반환한다.
export async function GET() {
  return NextResponse.json({ clubs: await listClubs() });
}
