import { NextResponse } from "next/server";
import { listClubs } from "@/app/clubs/data";

// 공개 동아리 목록을 불러온다.
// 조회 요청을 받아 동아리 처리를 하고 결과를 돌려준다.
export async function GET() {
  return NextResponse.json({ clubs: await listClubs() });
}
