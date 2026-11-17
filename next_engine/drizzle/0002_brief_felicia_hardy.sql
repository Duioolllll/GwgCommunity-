-- 데이터베이스에 어떤 표와 항목이 필요한지 정해 두는 파일이다. 적힌 순서대로 적용한다.
-- 아래 이름의 표를 만들고 저장할 항목과 자료형을 정한다.
CREATE TABLE "post_media" (
	"media_id" uuid PRIMARY KEY NOT NULL,
	"market_post_id" uuid,
	"finder_post_id" uuid,
	CONSTRAINT "post_media_exactly_one_post" CHECK (("post_media"."market_post_id" IS NOT NULL)::integer + ("post_media"."finder_post_id" IS NOT NULL)::integer = 1)
);
--> statement-breakpoint
-- 서로 관련된 표의 번호를 연결해 존재하지 않는 자료를 가리키지 못하게 한다.
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_media_id_media_assets_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- 서로 관련된 표의 번호를 연결해 존재하지 않는 자료를 가리키지 못하게 한다.
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_market_post_id_market_posts_id_fk" FOREIGN KEY ("market_post_id") REFERENCES "public"."market_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- 서로 관련된 표의 번호를 연결해 존재하지 않는 자료를 가리키지 못하게 한다.
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_finder_post_id_finder_posts_id_fk" FOREIGN KEY ("finder_post_id") REFERENCES "public"."finder_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- 자주 검색하는 항목에 찾기용 목록을 만들어 검색 속도를 높인다.
CREATE INDEX "post_media_market_idx" ON "post_media" USING btree ("market_post_id");--> statement-breakpoint
-- 자주 검색하는 항목에 찾기용 목록을 만들어 검색 속도를 높인다.
CREATE INDEX "post_media_finder_idx" ON "post_media" USING btree ("finder_post_id");