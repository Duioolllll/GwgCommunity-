import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

// Better Auth core tables. Privileged fields must never be accepted from sign-up input.
export const userRole = pgEnum("user_role", ["student", "admin"]);
export const userStatus = pgEnum("user_status", ["UNVERIFIED_EMAIL", "VERIFIED_PENDING_INVITE", "ACTIVE_STUDENT", "SUSPENDED"]);
export const marketStatus = pgEnum("market_status", ["AVAILABLE", "RESERVED", "COMPLETED"]);
export const reservationStatus = pgEnum("reservation_status", ["ACTIVE", "CANCELLED", "COMPLETED"]);
export const clubRole = pgEnum("club_role", ["owner", "manager", "member"]);
export const applicationStatus = pgEnum("application_status", ["SUBMITTED", "IN_REVIEW", "ACCEPTED", "REJECTED", "CANCELLED"]);
export const finderKind = pgEnum("finder_kind", ["lost", "found"]);
export const finderStatus = pgEnum("finder_status", ["ACTIVE", "CLOSED"]);
export const moderationStatus = pgEnum("moderation_status", ["PENDING", "APPROVED", "REJECTED"]);
export const reportStatus = pgEnum("report_status", ["OPEN", "REVIEWED", "RESOLVED"]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: userRole("role").notNull().default("student"),
  status: userStatus("status").notNull().default("UNVERIFIED_EMAIL"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (t) => [index("session_user_idx").on(t.userId)]);
export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"), refreshToken: text("refresh_token"), idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"), password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("account_user_idx").on(t.userId), uniqueIndex("account_provider_identity_idx").on(t.providerId, t.accountId)]);
export const verification = pgTable("verification", {
  id: text("id").primaryKey(), identifier: text("identifier").notNull(), value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("verification_identifier_idx").on(t.identifier)]);

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(), codeHash: text("code_hash").notNull().unique(),
  issuedBy: text("issued_by").notNull().references(() => user.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }), redeemedBy: text("redeemed_by").references(() => user.id),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [check("invitations_redemption_pair", sql`(${t.redeemedAt} IS NULL) = (${t.redeemedBy} IS NULL)`)]);
export const marketPosts = pgTable("market_posts", {
  id: uuid("id").primaryKey().defaultRandom(), ownerId: text("owner_id").notNull().references(() => user.id),
  title: varchar("title", { length: 120 }).notNull(), description: text("description").notNull(),
  price: integer("price").notNull(), category: varchar("category", { length: 50 }).notNull(),
  status: marketStatus("status").notNull().default("AVAILABLE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [check("market_price_nonnegative", sql`${t.price} >= 0`), index("market_search_idx").on(t.status, t.category, t.createdAt)]);
export const marketReservations = pgTable("market_reservations", {
  id: uuid("id").primaryKey().defaultRandom(), postId: uuid("post_id").notNull().references(() => marketPosts.id, { onDelete: "cascade" }),
  requesterId: text("requester_id").notNull().references(() => user.id), status: reservationStatus("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("market_one_active_reservation_idx").on(t.postId).where(sql`${t.status} = 'ACTIVE'`), index("reservation_requester_idx").on(t.requesterId)]);
export const clubs = pgTable("clubs", {
  id: uuid("id").primaryKey().defaultRandom(), slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(), category: varchar("category", { length: 50 }).notNull(),
  introduction: text("introduction").notNull(), isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const clubMembers = pgTable("club_members", {
  clubId: uuid("club_id").notNull().references(() => clubs.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id), role: clubRole("role").notNull().default("member"),
}, (t) => [primaryKey({ columns: [t.clubId, t.userId] })]);
export const clubPosts = pgTable("club_posts", {
  id: uuid("id").primaryKey().defaultRandom(), clubId: uuid("club_id").notNull().references(() => clubs.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull().references(() => user.id), title: varchar("title", { length: 120 }).notNull(),
  content: text("content").notNull(), isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("club_posts_club_idx").on(t.clubId, t.createdAt)]);
export const clubRecruitments = pgTable("club_recruitments", {
  id: uuid("id").primaryKey().defaultRandom(), clubId: uuid("club_id").notNull().references(() => clubs.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 120 }).notNull(), description: text("description").notNull(),
  opensAt: timestamp("opens_at", { withTimezone: true }).notNull(), closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
  isOpen: boolean("is_open").notNull().default(false),
}, (t) => [check("recruitment_dates_ordered", sql`${t.closesAt} > ${t.opensAt}`), index("recruitment_club_idx").on(t.clubId, t.isOpen)]);
export const clubApplications = pgTable("club_applications", {
  id: uuid("id").primaryKey().defaultRandom(), recruitmentId: uuid("recruitment_id").notNull().references(() => clubRecruitments.id, { onDelete: "cascade" }),
  applicantId: text("applicant_id").notNull().references(() => user.id), answers: jsonb("answers").notNull(),
  status: applicationStatus("status").notNull().default("SUBMITTED"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("application_recruitment_user_idx").on(t.recruitmentId, t.applicantId)]);
export const finderPosts = pgTable("finder_posts", {
  id: uuid("id").primaryKey().defaultRandom(), ownerId: text("owner_id").notNull().references(() => user.id),
  kind: finderKind("kind").notNull(), title: varchar("title", { length: 120 }).notNull(), category: varchar("category", { length: 50 }).notNull(),
  color: varchar("color", { length: 50 }).notNull(), generalLocation: varchar("general_location", { length: 120 }).notNull(), occurredAt: date("occurred_at").notNull(),
  status: finderStatus("status").notNull().default("ACTIVE"), publicApproval: moderationStatus("public_approval").notNull().default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("finder_search_idx").on(t.kind, t.status, t.category, t.occurredAt)]);
export const finderMatches = pgTable("finder_matches", {
  lostId: uuid("lost_id").notNull().references(() => finderPosts.id, { onDelete: "cascade" }),
  foundId: uuid("found_id").notNull().references(() => finderPosts.id, { onDelete: "cascade" }), score: integer("score").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.lostId, t.foundId] }), check("finder_match_score_range", sql`${t.score} BETWEEN 0 AND 100`), check("finder_match_distinct", sql`${t.lostId} <> ${t.foundId}`)]);
export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").primaryKey().defaultRandom(), ownerId: text("owner_id").notNull().references(() => user.id),
  storageKey: text("storage_key").notNull().unique(), contentType: varchar("content_type", { length: 100 }).notNull(), size: integer("size").notNull(),
  moderation: moderationStatus("moderation").notNull().default("PENDING"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [check("media_size_positive", sql`${t.size} > 0`)]);
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(), reporterId: text("reporter_id").notNull().references(() => user.id),
  targetType: varchar("target_type", { length: 40 }).notNull(), targetId: text("target_id").notNull(), reason: text("reason").notNull(),
  status: reportStatus("status").notNull().default("OPEN"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("reports_status_idx").on(t.status, t.createdAt)]);
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(), actorId: text("actor_id").references(() => user.id), action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(), entityId: text("entity_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("audit_created_idx").on(t.createdAt)]);
