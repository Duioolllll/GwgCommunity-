-- 데이터베이스 스키마 이력: 테이블·열·관계·인덱스 제약을 순서대로 적용한다.
-- 스키마 작업 CREATE TABLE: "post_media" (
CREATE TABLE "post_media" (
	"media_id" uuid PRIMARY KEY NOT NULL,
	"market_post_id" uuid,
	"finder_post_id" uuid,
	CONSTRAINT "post_media_exactly_one_post" CHECK (("post_media"."market_post_id" IS NOT NULL)::integer + ("post_media"."finder_post_id" IS NOT NULL)::integer = 1)
);
--> statement-breakpoint
-- 스키마 작업 ALTER TABLE: "post_media" ADD CONSTRAINT "post_media_media_id_media_assets_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_media_id_media_assets_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- 스키마 작업 ALTER TABLE: "post_media" ADD CONSTRAINT "post_media_market_post_id_market_posts_id_fk" FOREIGN KEY ("market_post_id") REFERENCES "public"."market_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_market_post_id_market_posts_id_fk" FOREIGN KEY ("market_post_id") REFERENCES "public"."market_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- 스키마 작업 ALTER TABLE: "post_media" ADD CONSTRAINT "post_media_finder_post_id_finder_posts_id_fk" FOREIGN KEY ("finder_post_id") REFERENCES "public"."finder_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_finder_post_id_finder_posts_id_fk" FOREIGN KEY ("finder_post_id") REFERENCES "public"."finder_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- 스키마 작업 CREATE INDEX: "post_media_market_idx" ON "post_media" USING btree ("market_post_id");--> statement-breakpoint
CREATE INDEX "post_media_market_idx" ON "post_media" USING btree ("market_post_id");--> statement-breakpoint
-- 스키마 작업 CREATE INDEX: "post_media_finder_idx" ON "post_media" USING btree ("finder_post_id");
CREATE INDEX "post_media_finder_idx" ON "post_media" USING btree ("finder_post_id");