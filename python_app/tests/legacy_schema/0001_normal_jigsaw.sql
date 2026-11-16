-- 데이터베이스 스키마 이력: 테이블·열·관계·인덱스 제약을 순서대로 적용한다.
-- 스키마 작업 CREATE TABLE: "invitation_attempts" (
CREATE TABLE "invitation_attempts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_start" timestamp with time zone NOT NULL
);
--> statement-breakpoint
-- 스키마 작업 CREATE TABLE: "rate_limit" (
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
-- 스키마 작업 ALTER TABLE: "invitation_attempts" ADD CONSTRAINT "invitation_attempts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "invitation_attempts" ADD CONSTRAINT "invitation_attempts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;