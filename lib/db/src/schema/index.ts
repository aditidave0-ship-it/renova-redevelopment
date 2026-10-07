// Export your models here. Add one export per file
// export * from "./posts";
//
// Each model/table should ideally be split into different files.
// Each model/table should define a Drizzle table, insert schema, and types:
//
//   import { pgTable, text, serial } from "drizzle-orm/pg-core";
//   import { createInsertSchema } from "drizzle-zod";
//   import { z } from "zod/v4";
//
//   export const postsTable = pgTable("posts", {
//     id: serial("id").primaryKey(),
//     title: text("title").notNull(),
//   });
//
//   export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true });
//   export type InsertPost = z.infer<typeof insertPostSchema>;
//   export type Post = typeof postsTable.$inferSelect;

import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const accountRole = pgEnum("account_role", [
  "SOCIETY",
  "DEVELOPER",
  "PMC",
  "PROFESSIONAL",
  "ADMIN",
]);
export const organizationKind = pgEnum("organization_kind", [
  "SOCIETY",
  "DEVELOPER",
  "PMC",
  "PROFESSIONAL",
]);
export const opportunityStatus = pgEnum("opportunity_status", [
  "DRAFT",
  "PUBLISHED",
  "UNDER_REVIEW",
  "CLOSED",
]);
export const interestStatus = pgEnum("interest_status", [
  "PENDING",
  "ACCEPTED",
  "DECLINED",
  "CANCELLED",
]);
export const authTokenPurpose = pgEnum("auth_token_purpose", [
  "EMAIL_VERIFICATION",
  "PASSWORD_RESET",
]);
export const enquiryStatus = pgEnum("enquiry_status", [
  "NEW",
  "IN_REVIEW",
  "CONTACTED",
  "CLOSED",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    credentialVersion: integer("credential_version").default(0).notNull(),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    role: accountRole("role").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("users_role_idx").on(table.role)],
);

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 220 }).notNull(),
    kind: organizationKind("kind").notNull(),
    location: varchar("location", { length: 160 }),
    website: varchar("website", { length: 500 }),
    description: text("description"),
    specialization: varchar("specialization", { length: 80 }),
    services: text("services"),
    credentials: text("credentials"),
    portfolio: text("portfolio"),
    ...timestamps,
  },
  (table) => [index("organizations_kind_idx").on(table.kind)],
);

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("organization_members_unique_idx").on(
      table.organizationId,
      table.userId,
    ),
  ],
);

export const societies = pgTable("societies", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  address: text("address"),
  city: varchar("city", { length: 120 }).default("Mumbai").notNull(),
  memberCount: integer("member_count"),
  buildingAge: integer("building_age"),
  redevelopmentStatus: varchar("redevelopment_status", { length: 120 }),
  ...timestamps,
});

export const opportunities = pgTable(
  "redevelopment_opportunities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    societyId: uuid("society_id")
      .notNull()
      .references(() => societies.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 220 }).notNull(),
    location: varchar("location", { length: 180 }).notNull(),
    description: text("description").notNull(),
    memberCount: integer("member_count"),
    buildingAge: integer("building_age"),
    siteArea: varchar("site_area", { length: 80 }),
    status: opportunityStatus("status").default("DRAFT").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("opportunities_status_idx").on(table.status),
    index("opportunities_society_idx").on(table.societyId),
  ],
);

export const opportunityInterests = pgTable(
  "opportunity_interests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    submittedByUserId: uuid("submitted_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    message: text("message"),
    status: interestStatus("status").default("PENDING").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("opportunity_interests_unique_idx").on(
      table.opportunityId,
      table.organizationId,
    ),
    index("opportunity_interests_status_idx").on(table.status),
  ],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
    credentialVersion: integer("credential_version").default(0).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    index("auth_sessions_user_idx").on(table.userId),
    index("auth_sessions_expiry_idx").on(table.expiresAt),
  ],
);

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: authTokenPurpose("purpose").notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("auth_tokens_user_purpose_idx").on(table.userId, table.purpose),
    index("auth_tokens_expiry_idx").on(table.expiresAt),
  ],
);

export const enquiries = pgTable(
  "enquiries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reference: varchar("reference", { length: 40 }).notNull().unique(),
    name: varchar("name", { length: 160 }).notNull(),
    organizationName: varchar("organization_name", { length: 220 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    phone: varchar("phone", { length: 40 }).notNull(),
    city: varchar("city", { length: 160 }).notNull(),
    actorType: varchar("actor_type", { length: 80 }).notNull(),
    experienceYears: integer("experience_years"),
    message: text("message").notNull(),
    source: varchar("source", { length: 80 }).default("WEBSITE").notNull(),
    status: enquiryStatus("status").default("NEW").notNull(),
    requestFingerprint: varchar("request_fingerprint", {
      length: 64,
    }).notNull(),
    ...timestamps,
  },
  (table) => [
    index("enquiries_status_created_idx").on(table.status, table.createdAt),
    index("enquiries_fingerprint_created_idx").on(
      table.requestFingerprint,
      table.createdAt,
    ),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 120 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: uuid("entity_id"),
    metadata: text("metadata"),
    ...timestamps,
  },
  (table) => [
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  ],
);

export const feasibilityRequests = pgTable("feasibility_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  societyId: uuid("society_id").notNull().references(() => societies.id, { onDelete: "cascade" }),
  submittedByUserId: uuid("submitted_by_user_id").notNull().references(() => users.id),
  propertyAddress: text("property_address").notNull(),
  siteArea: varchar("site_area", { length: 80 }),
  memberCount: integer("member_count"),
  buildingAge: integer("building_age"),
  requirement: text("requirement").notNull(),
  propertyInformation: text("property_information"),
  regulatoryInformation: text("regulatory_information"),
  status: varchar("status", { length: 40 }).default("SUBMITTED").notNull(),
  assessmentNotes: text("assessment_notes"),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  ...timestamps,
}, table => [index("feasibility_society_idx").on(table.societyId), index("feasibility_status_idx").on(table.status)]);

export const organizationRelations = relations(
  organizations,
  ({ many, one }) => ({
    members: many(organizationMembers),
    society: one(societies),
  }),
);
export const societyRelations = relations(societies, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [societies.organizationId],
    references: [organizations.id],
  }),
  opportunities: many(opportunities),
}));
export const opportunityRelations = relations(
  opportunities,
  ({ one, many }) => ({
    society: one(societies, {
      fields: [opportunities.societyId],
      references: [societies.id],
    }),
    interests: many(opportunityInterests),
  }),
);
