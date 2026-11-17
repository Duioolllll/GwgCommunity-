-- 예전 데이터베이스에 필요한 저장 표와 상태 선택지를 순서대로 만든다.
-- 이 기능에서 쓰는 데이터를 보관할 표를 만든다.
CREATE TABLE "post_media" (
	"media_id" uuid PRIMARY KEY NOT NULL,
	"market_post_id" uuid,
	"finder_post_id" uuid,
	CONSTRAINT "post_media_exactly_one_post" CHECK (("post_media"."market_post_id" IS NOT NULL)::integer + ("post_media"."finder_post_id" IS NOT NULL)::integer = 1)
);
--> statement-breakpoint
-- 이미 있는 표에 데이터 연결 또는 잘못된 값 방지 규칙을 추가한다.
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_media_id_media_assets_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- 이미 있는 표에 데이터 연결 또는 잘못된 값 방지 규칙을 추가한다.
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_market_post_id_market_posts_id_fk" FOREIGN KEY ("market_post_id") REFERENCES "public"."market_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- 이미 있는 표에 데이터 연결 또는 잘못된 값 방지 규칙을 추가한다.
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_finder_post_id_finder_posts_id_fk" FOREIGN KEY ("finder_post_id") REFERENCES "public"."finder_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- 같은 값이 중복되면 안 되는 항목이나 빠르게 찾을 항목의 규칙을 만든다.
CREATE INDEX "post_media_market_idx" ON "post_media" USING btree ("market_post_id");--> statement-breakpoint
-- 같은 값이 중복되면 안 되는 항목이나 빠르게 찾을 항목의 규칙을 만든다.
CREATE INDEX "post_media_finder_idx" ON "post_media" USING btree ("finder_post_id");