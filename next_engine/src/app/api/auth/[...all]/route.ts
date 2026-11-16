/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { getAuth } from "@/lib/auth";

// 인증 GET 요청을 인증 라이브러리에 전달한다.
// 기능 `GET`(request): `getAuth().handler(request)`를 반환한다.
export async function GET(request: Request) { return getAuth().handler(request); }
// 인증 POST 요청을 인증 라이브러리에 전달한다.
// 기능 `POST`(request): `getAuth().handler(request)`를 반환한다.
export async function POST(request: Request) { return getAuth().handler(request); }
