import { getAuth } from "@/lib/auth";

// 인증 GET 요청을 인증 라이브러리에 전달한다.
// 조회 요청을 받아 계정 인증 처리를 하고 결과를 돌려준다.
export async function GET(request: Request) { return getAuth().handler(request); }
// 인증 POST 요청을 인증 라이브러리에 전달한다.
// 등록 요청을 받아 계정 인증 처리를 하고 결과를 돌려준다.
export async function POST(request: Request) { return getAuth().handler(request); }
