-- 예전 데이터베이스에 필요한 저장 표와 상태 선택지를 순서대로 만든다.
-- 이 기능에서 쓰는 데이터를 보관할 표를 만든다.
CREATE TABLE "invitation_attempts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_start" timestamp with time zone NOT NULL
);
--> statement-breakpoint
-- 이 기능에서 쓰는 데이터를 보관할 표를 만든다.
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
-- 이미 있는 표에 데이터 연결 또는 잘못된 값 방지 규칙을 추가한다.
ALTER TABLE "invitation_attempts" ADD CONSTRAINT "invitation_attempts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;