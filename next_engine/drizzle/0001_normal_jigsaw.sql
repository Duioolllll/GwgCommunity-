-- 데이터베이스에 어떤 표와 항목이 필요한지 정해 두는 파일이다. 적힌 순서대로 적용한다.
-- 아래 이름의 표를 만들고 저장할 항목과 자료형을 정한다.
CREATE TABLE "invitation_attempts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_start" timestamp with time zone NOT NULL
);
--> statement-breakpoint
-- 아래 이름의 표를 만들고 저장할 항목과 자료형을 정한다.
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
-- 서로 관련된 표의 번호를 연결해 존재하지 않는 자료를 가리키지 못하게 한다.
ALTER TABLE "invitation_attempts" ADD CONSTRAINT "invitation_attempts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;