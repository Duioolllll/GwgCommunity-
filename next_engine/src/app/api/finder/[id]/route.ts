/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { errorResponse, jsonBody } from "@/lib/api";
import { uuidPattern } from "@/features/moderation/service";
import { parseFinderInput } from "@/features/finder/posts";
import { FinderMutationError, mutateFinderPost } from "@/features/finder/service";

type Params = { params: Promise<{ id: string }> };
// 기능 `handle`(request, { params }, method): 먼저 `const viewer = await getCurrentUser(await headers());`를 실행한다.
async function handle(request: Request, { params }: Params, method: "PATCH" | "DELETE") {
  const viewer = await getCurrentUser(await headers());
  // 조건 `!viewer`: 참이면 `errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!viewer) return errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401);
  // 조건 `!viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT"`: 참이면 `errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!viewer.emailVerified`: 거짓인 경우에만 오른쪽 `viewer.status !== "ACTIVE_STUDENT"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT") return errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403);
  const { id } = await params;
  // 조건 `!uuidPattern.test(id)`: 참이면 `errorResponse("NOT_FOUND", "게시물을 찾을 수 없습니다.", 404)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!uuidPattern.test(id)) return errorResponse("NOT_FOUND", "게시물을 찾을 수 없습니다.", 404);
  let action: Parameters<typeof mutateFinderPost>[3] = { type: "delete" };
  // 조건 `method === "PATCH"`: 참이면 먼저 `const body = await jsonBody(request);`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (method === "PATCH") {
    const body = await jsonBody(request);
    // 조건 `body?.action === "close" && Object.keys(body).length === 1`: 참이면 먼저 `action = { type: "close" };`를 실행한다. 거짓이면 먼저 `const input = parseFinderInput(body);`를 실행한다.
    // 단락 분기 `body?.action === "close"`: 참인 경우에만 오른쪽 `Object.keys(body).length === 1`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    if (body?.action === "close" && Object.keys(body).length === 1) action = { type: "close" };
    else {
      const input = parseFinderInput(body);
      // Attachments cannot be changed through this endpoint.
      // 조건 `!input || !body || Object.keys(body).some(key => !["kind", "title", "category", "color", "generalLocation", "occurredAt"].includes(key))`: 참이면 `errorResponse("INVALID_INPUT", "분실물 정보를 확인하세요.", 400)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
      // 단락 분기 `!input || !body`: 거짓인 경우에만 오른쪽 `Object.keys(body).some(key => !["kind", "title", "category", "color", "generalLocation", "occurredAt"].includes(key))`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
      // 단락 분기 `!input`: 거짓인 경우에만 오른쪽 `!body`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
      // 기능 `콜백`(key): `!["kind", "title", "category", "color", "generalLocation", "occurredAt"].includes(key)` 평가 결과를 반환한다.
      if (!input || !body || Object.keys(body).some(key => !["kind", "title", "category", "color", "generalLocation", "occurredAt"].includes(key))) return errorResponse("INVALID_INPUT", "분실물 정보를 확인하세요.", 400);
      action = { type: "edit", input };
    }
  }
  // 예외 처리: 본문 실행 중 예외가 발생하면 `error instanceof FinderMutationError` 조건을 추가로 검사한다.
  try {
    await mutateFinderPost(getDb(), id, viewer.id, action);
    return NextResponse.json({ ok: true });
  } catch (error) {
    // 조건 `error instanceof FinderMutationError`: 참이면 먼저 `const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 409;`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (error instanceof FinderMutationError) {
      // 선택 조건 `error.code === "NOT_FOUND"`: 참이면 `404`, 거짓이면 `error.code === "FORBIDDEN" ? 403 : 409`를 사용한다.
      // 선택 조건 `error.code === "FORBIDDEN"`: 참이면 `403`, 거짓이면 `409`를 사용한다.
      const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 409;
      // 선택 조건 `status === 404`: 참이면 `"게시물을 찾을 수 없습니다."`, 거짓이면 `status === 403 ? "작성자만 변경할 수 있습니다." : "종료된 게시물은 변경할 수 없습니다."`를 사용한다.
      // 선택 조건 `status === 403`: 참이면 `"작성자만 변경할 수 있습니다."`, 거짓이면 `"종료된 게시물은 변경할 수 없습니다."`를 사용한다.
      return errorResponse(error.code, status === 404 ? "게시물을 찾을 수 없습니다." : status === 403 ? "작성자만 변경할 수 있습니다." : "종료된 게시물은 변경할 수 없습니다.", status);
    }
    throw error;
  }
}
// 분실물 수정 또는 종료를 공통 처리기에 전달한다.
// 기능 `PATCH`(request, params): `handle(request, params, "PATCH")`를 반환한다.
export function PATCH(request: Request, params: Params) { return handle(request, params, "PATCH"); }
// 분실물 삭제를 공통 처리기에 전달한다.
// 기능 `DELETE`(request, params): `handle(request, params, "DELETE")`를 반환한다.
export function DELETE(request: Request, params: Params) { return handle(request, params, "DELETE"); }
