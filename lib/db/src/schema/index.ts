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
  jsonb,
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
export const feasibilityStatus = pgEnum("feasibility_status", [
  "DRAFT",
  "SUBMITTED",
  "IN_REVIEW",
  "MORE_INFORMATION_REQUIRED",
  "ASSESSMENT_READY",
  "CLOSED",
]);
export const feasibilityDocumentStatus = pgEnum("feasibility_document_status", [
  "PENDING_UPLOAD",
  "AVAILABLE",
  "REMOVED",
]);
export const professionalSpecialization = pgEnum(
  "professional_specialization",
  [
    "ADVOCATE_LEGAL",
    "ARCHITECT",
    "STRUCTURAL_CONSULTANT",
    "VALUATION_FINANCE",
    "OTHER",
  ],
);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export type PortfolioEntry = {
  title: string;
  location?: string | null;
  description?: string | null;
  completionYear?: number | null;
  projectType?: string | null;
};

export type ProfileCredential = {
  name: string;
  issuer?: string | null;
  reference?: string | null;
  isPublic?: boolean;
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
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
    role: accountRole("role"),
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
  contactName: varchar("contact_name", { length: 160 }),
  contactEmail: varchar("contact_email", { length: 320 }),
  contactPhone: varchar("contact_phone", { length: 40 }),
  numberBuildings: integer("number_buildings"),
  numberWings: integer("number_wings"),
  unitCount: integer("unit_count"),
  propertyType: varchar("property_type", { length: 120 }),
  landArea: varchar("land_area", { length: 120 }),
  description: text("description"),
  marketplaceVisible: boolean("marketplace_visible").default(true).notNull(),
  ...timestamps,
});

export const developerProfiles = pgTable("developer_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  logoUrl: varchar("logo_url", { length: 1000 }),
  description: text("description"),
  website: varchar("website", { length: 500 }),
  publicEmail: varchar("public_email", { length: 320 }),
  publicPhone: varchar("public_phone", { length: 40 }),
  officeLocation: varchar("office_location", { length: 220 }),
  areasServed: jsonb("areas_served").$type<string[]>().default([]).notNull(),
  specializations: jsonb("specializations")
    .$type<string[]>()
    .default([])
    .notNull(),
  teamInformation: text("team_information"),
  portfolio: jsonb("portfolio").$type<PortfolioEntry[]>().default([]).notNull(),
  credentials: jsonb("credentials")
    .$type<ProfileCredential[]>()
    .default([])
    .notNull(),
  marketplaceVisible: boolean("marketplace_visible").default(true).notNull(),
  ...timestamps,
});

export const pmcProfiles = pgTable("pmc_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  logoUrl: varchar("logo_url", { length: 1000 }),
  description: text("description"),
  website: varchar("website", { length: 500 }),
  publicEmail: varchar("public_email", { length: 320 }),
  publicPhone: varchar("public_phone", { length: 40 }),
  officeLocation: varchar("office_location", { length: 220 }),
  locationsServed: jsonb("locations_served")
    .$type<string[]>()
    .default([])
    .notNull(),
  services: jsonb("services").$type<string[]>().default([]).notNull(),
  specializations: jsonb("specializations")
    .$type<string[]>()
    .default([])
    .notNull(),
  teamInformation: text("team_information"),
  portfolio: jsonb("portfolio").$type<PortfolioEntry[]>().default([]).notNull(),
  credentials: jsonb("credentials")
    .$type<ProfileCredential[]>()
    .default([])
    .notNull(),
  marketplaceVisible: boolean("marketplace_visible").default(true).notNull(),
  ...timestamps,
});

export const professionalProfiles = pgTable("professional_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  specialization: professionalSpecialization("specialization").notNull(),
  description: text("description"),
  publicEmail: varchar("public_email", { length: 320 }),
  publicPhone: varchar("public_phone", { length: 40 }),
  website: varchar("website", { length: 500 }),
  services: jsonb("services").$type<string[]>().default([]).notNull(),
  credentials: jsonb("credentials")
    .$type<ProfileCredential[]>()
    .default([])
    .notNull(),
  marketplaceVisible: boolean("marketplace_visible").default(false).notNull(),
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
    reviewStatus: varchar("review_status", { length: 32 })
      .default("RECEIVED")
      .notNull(),
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

export const feasibilityRequests = pgTable(
  "feasibility_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reference: varchar("reference", { length: 40 }).notNull().unique(),
    societyId: uuid("society_id")
      .notNull()
      .references(() => societies.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assignedReviewerUserId: uuid("assigned_reviewer_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    status: feasibilityStatus("status").default("DRAFT").notNull(),
    societyName: varchar("society_name", { length: 220 }).notNull(),
    propertyAddress: text("property_address").notNull(),
    locality: varchar("locality", { length: 180 }).notNull(),
    city: varchar("city", { length: 120 }).notNull(),
    pinCode: varchar("pin_code", { length: 12 }).notNull(),
    contactPerson: varchar("contact_person", { length: 160 }).notNull(),
    contactEmail: varchar("contact_email", { length: 320 }).notNull(),
    contactPhone: varchar("contact_phone", { length: 40 }).notNull(),
    missingInformation: text("missing_information"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("feasibility_requests_society_idx").on(table.societyId),
    index("feasibility_requests_status_idx").on(table.status),
  ],
);

export const feasibilityPropertyData = pgTable(
  "feasibility_property_data",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .unique()
      .references(() => feasibilityRequests.id, { onDelete: "cascade" }),
    plotArea: varchar("plot_area", { length: 160 }),
    numberBuildings: integer("number_buildings"),
    numberWings: integer("number_wings"),
    existingFloors: varchar("existing_floors", { length: 160 }),
    residentialUnits: integer("residential_units"),
    commercialUnits: integer("commercial_units"),
    existingBuiltUpInformation: text("existing_built_up_information"),
    approximateBuildingAge: integer("approximate_building_age"),
    existingParking: text("existing_parking"),
    existingAmenities: text("existing_amenities"),
    ctsSurveyInformation: text("cts_survey_information"),
    existingApprovedPlans: text("existing_approved_plans"),
    propertyCardInformation: text("property_card_information"),
    conveyanceInformation: text("conveyance_information"),
    existingFsiInformation: text("existing_fsi_information"),
    roadWidth: varchar("road_width", { length: 160 }),
    reservationsRestrictions: text("reservations_restrictions"),
    otherPropertyInformation: text("other_property_information"),
    unknownFields: jsonb("unknown_fields")
      .$type<string[]>()
      .default([])
      .notNull(),
    ...timestamps,
  },
  (table) => [index("feasibility_property_request_idx").on(table.requestId)],
);

export const feasibilityDocuments = pgTable(
  "feasibility_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => feasibilityRequests.id, { onDelete: "cascade" }),
    uploadedByUserId: uuid("uploaded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    category: varchar("category", { length: 80 }).notNull(),
    fileName: varchar("file_name", { length: 500 }).notNull(),
    contentType: varchar("content_type", { length: 160 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageProvider: varchar("storage_provider", { length: 80 }).notNull(),
    storageKey: varchar("storage_key", { length: 1000 }).notNull().unique(),
    checksumSha256: varchar("checksum_sha256", { length: 64 }),
    status: feasibilityDocumentStatus("status")
      .default("PENDING_UPLOAD")
      .notNull(),
    ...timestamps,
  },
  (table) => [index("feasibility_documents_request_idx").on(table.requestId)],
);

export const feasibilityAssessments = pgTable("feasibility_assessments", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestId: uuid("request_id")
    .notNull()
    .unique()
    .references(() => feasibilityRequests.id, { onDelete: "cascade" }),
  preparedByUserId: uuid("prepared_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  existingProperty: text("existing_property"),
  plotInformation: text("plot_information"),
  existingBuiltUpArea: text("existing_built_up_area"),
  applicablePlanningInputs: text("applicable_planning_inputs"),
  potentialDevelopmentInputs: text("potential_development_inputs"),
  rehabilitationRequirement: text("rehabilitation_requirement"),
  potentialSaleComponent: text("potential_sale_component"),
  parkingAmenityConsiderations: text("parking_amenity_considerations"),
  keyConstraints: text("key_constraints"),
  professionalNotes: text("professional_notes"),
  documentsReviewed: jsonb("documents_reviewed")
    .$type<string[]>()
    .default([])
    .notNull(),
  assessmentDate: timestamp("assessment_date", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  ...timestamps,
});

export const feasibilityAssumptions = pgTable(
  "feasibility_assumptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => feasibilityAssessments.id, { onDelete: "cascade" }),
    statement: text("statement").notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    index("feasibility_assumptions_assessment_idx").on(table.assessmentId),
  ],
);

export const feasibilityStatusHistory = pgTable(
  "feasibility_status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => feasibilityRequests.id, { onDelete: "cascade" }),
    fromStatus: feasibilityStatus("from_status"),
    toStatus: feasibilityStatus("to_status").notNull(),
    changedByUserId: uuid("changed_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("feasibility_status_history_request_idx").on(
      table.requestId,
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
  feasibilityRequests: many(feasibilityRequests),
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
