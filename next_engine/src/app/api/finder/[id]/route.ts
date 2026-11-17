import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { errorResponse, jsonBody } from "@/lib/api";
import { uuidPattern } from "@/features/moderation/service";
import { parseFinderInput } from "@/features/finder/posts";
import { FinderMutationError, mutateFinderPost } from "@/features/finder/service";

type Params = { params: Promise<{ id: string }> };
// 수정과 삭제에서 공통으로 필요한 권한·입력 검사를 처리한다.
async function handle(request: Request, { params }: Params, method: "PATCH" | "DELETE") {
  const viewer = await getCurrentUser(await headers());
  // 확인할 조건: viewer 없음 또는 false. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!viewer) return errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401);
  // 확인할 조건: (viewer의 이메일 인증 여부 없음 또는 false) 또는 (viewer의 상태 ≠ “인증된 학생”). 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT") return errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403);
  const { id } = await params;
  // 확인할 조건: 고유 번호의 형식이 맞음 조건을 만족하지 않음. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!uuidPattern.test(id)) return errorResponse("NOT_FOUND", "게시물을 찾을 수 없습니다.", 404);
  let action: Parameters<typeof mutateFinderPost>[3] = { type: "delete" };
  // 확인할 조건: 요청 방식 = “수정”. 해당하면 이 경우에 필요한 자료를 준비한다.
  if (method === "PATCH") {
    const body = await jsonBody(request);
    // 확인할 조건: (요청 내용의 선택한 작업 = “종료”) 그리고 (keys 처리 결과의 개수 또는 길이 = 1). 해당하면 선택한 작업을 필요한 항목을 묶은 자료으로 바꾼다. 해당하지 않으면 이 경우에 필요한 자료를 준비한다.
    if (body?.action === "close" && Object.keys(body).length === 1) action = { type: "close" };
    else {
      const input = parseFinderInput(body);
      // 이 수정 요청에서는 첨부 이미지를 바꿀 수 없다.
      // 확인할 조건: ((입력 내용 없음 또는 false) 또는 (요청 내용 없음 또는 false)) 또는 (some 처리 결과 있음 또는 true). 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
      // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
      if (!input || !body || Object.keys(body).some(key => !["kind", "title", "category", "color", "generalLocation", "occurredAt"].includes(key))) return errorResponse("INVALID_INPUT", "분실물 정보를 확인하세요.", 400);
      action = { type: "edit", input };
    }
  }
  // 아래 작업을 시도한다. 실패하면 추가 조건을 한 번 더 확인한다.
  try {
    await mutateFinderPost(getDb(), id, viewer.id, action);
    return NextResponse.json({ ok: true });
  } catch (error) {
    // 확인할 조건: 오류가 FinderMutationError 종류. 해당하면 이 경우에 필요한 자료를 준비한다.
    if (error instanceof FinderMutationError) {
      // 선택 기준: 오류의 종류 = “NOT_FOUND”. 맞으면 404를 사용하고, 아니면 다음 조건에 따라 고르는 값을 사용한다.
      // 선택 기준: 오류의 종류 = “권한 없음”. 맞으면 403를 사용하고, 아니면 409를 사용한다.
      const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 409;
      // 선택 기준: 상태 = 404. 맞으면 “게시물을 찾을 수 없습니다.” 값을 사용하고, 아니면 다음 조건에 따라 고르는 값을 사용한다.
      // 선택 기준: 상태 = 403. 맞으면 “작성자만 변경할 수 있습니다.” 값을 사용하고, 아니면 “종료된 게시물은 변경할 수 없습니다.” 값을 사용한다.
      return errorResponse(error.code, status === 404 ? "게시물을 찾을 수 없습니다." : status === 403 ? "작성자만 변경할 수 있습니다." : "종료된 게시물은 변경할 수 없습니다.", status);
    }
    throw error;
  }
}
// 분실물 수정 또는 종료를 공통 처리기에 전달한다.
// 수정 요청을 받아 분실물 처리를 하고 결과를 돌려준다.
export function PATCH(request: Request, params: Params) { return handle(request, params, "PATCH"); }
// 분실물 삭제를 공통 처리기에 전달한다.
// 삭제 요청을 받아 분실물 처리를 하고 결과를 돌려준다.
export function DELETE(request: Request, params: Params) { return handle(request, params, "DELETE"); }
