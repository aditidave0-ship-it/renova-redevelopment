import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const accountRoleEnum = pgEnum("account_role", ["society", "developer", "pmc", "professional", "admin"]);
export const organizationTypeEnum = pgEnum("organization_type", ["society", "developer", "pmc", "professional", "renova"]);
export const projectStageEnum = pgEnum("project_stage", ["profile", "requirements", "discover", "connect", "proposals", "compare", "selection", "project"]);
export const membershipStatusEnum = pgEnum("membership_status", ["invited", "active", "suspended", "removed"]);
export const opportunityStatusEnum = pgEnum("opportunity_status", ["draft", "review", "published", "invited", "closed"]);
export const proposalStatusEnum = pgEnum("proposal_status", ["draft", "submitted", "clarification", "withdrawn", "shortlisted", "not_selected", "selected"]);
export const verificationStatusEnum = pgEnum("verification_status", ["public", "pending", "verified", "rejected", "expired"]);

export const platformUsers = pgTable("platform_users", {
  id: uuid("id").defaultRandom().primaryKey(), email: text("email").notNull(), displayName: text("display_name").notNull(), role: accountRoleEnum("role").notNull(),
  isActive: boolean("is_active").default(true).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("platform_users_email_idx").on(table.email)]);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(), name: text("name").notNull(), slug: text("slug").notNull(), type: organizationTypeEnum("type").notNull(),
  verificationStatus: verificationStatusEnum("verification_status").default("public").notNull(), profile: jsonb("profile").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("organizations_slug_idx").on(table.slug), index("organizations_type_idx").on(table.type)]);

export const organizationMemberships = pgTable("organization_memberships", {
  id: uuid("id").defaultRandom().primaryKey(), organizationId: uuid("organization_id").references(() => organizations.id).notNull(), userId: uuid("user_id").references(() => platformUsers.id).notNull(),
  status: membershipStatusEnum("status").default("invited").notNull(), permissions: jsonb("permissions").$type<string[]>().default([]).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("organization_membership_unique_idx").on(table.organizationId, table.userId)]);

export const redevelopmentProjects = pgTable("redevelopment_projects", {
  id: uuid("id").defaultRandom().primaryKey(), societyOrganizationId: uuid("society_organization_id").references(() => organizations.id).notNull(), name: text("name").notNull(), reference: text("reference").notNull(),
  location: text("location").notNull(), stage: projectStageEnum("stage").default("profile").notNull(), summary: text("summary"), profile: jsonb("profile").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("redevelopment_projects_reference_idx").on(table.reference), index("redevelopment_projects_society_idx").on(table.societyOrganizationId)]);

export const projectMemberships = pgTable("project_memberships", {
  id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").references(() => redevelopmentProjects.id).notNull(), organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  role: accountRoleEnum("role").notNull(), status: membershipStatusEnum("status").default("invited").notNull(), permissions: jsonb("permissions").$type<string[]>().default([]).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("project_membership_unique_idx").on(table.projectId, table.organizationId)]);

export const opportunities = pgTable("opportunities", {
  id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").references(() => redevelopmentProjects.id).notNull(), status: opportunityStatusEnum("status").default("draft").notNull(),
  publicSummary: text("public_summary"), requirements: jsonb("requirements").$type<Record<string, unknown>>().default({}).notNull(), publishedAt: timestamp("published_at", { withTimezone: true }), closesAt: timestamp("closes_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("opportunities_project_idx").on(table.projectId), index("opportunities_status_idx").on(table.status)]);

export const opportunityConnections = pgTable("opportunity_connections", {
  id: uuid("id").defaultRandom().primaryKey(), opportunityId: uuid("opportunity_id").references(() => opportunities.id).notNull(), organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  status: text("status").default("interest_submitted").notNull(), permissionScope: jsonb("permission_scope").$type<string[]>().default([]).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("opportunity_connection_unique_idx").on(table.opportunityId, table.organizationId)]);

export const proposals = pgTable("proposals", {
  id: uuid("id").defaultRandom().primaryKey(), opportunityId: uuid("opportunity_id").references(() => opportunities.id).notNull(), developerOrganizationId: uuid("developer_organization_id").references(() => organizations.id).notNull(),
  status: proposalStatusEnum("status").default("draft").notNull(), version: integer("version").default(1).notNull(), submittedAt: timestamp("submitted_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("proposal_developer_opportunity_idx").on(table.opportunityId, table.developerOrganizationId)]);

export const proposalTerms = pgTable("proposal_terms", {
  id: uuid("id").defaultRandom().primaryKey(), proposalId: uuid("proposal_id").references(() => proposals.id).notNull(), fieldKey: text("field_key").notNull(), label: text("label").notNull(),
  value: jsonb("value").$type<string | number | boolean | null>().notNull(), sourceDocumentId: uuid("source_document_id"), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("proposal_term_unique_idx").on(table.proposalId, table.fieldKey)]);

export const projectDocuments = pgTable("project_documents", {
  id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").references(() => redevelopmentProjects.id).notNull(), ownerOrganizationId: uuid("owner_organization_id").references(() => organizations.id).notNull(),
  name: text("name").notNull(), category: text("category").notNull(), storageKey: text("storage_key").notNull(), visibleToRoles: jsonb("visible_to_roles").$type<Array<"society" | "developer" | "pmc" | "professional" | "admin">>().default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("project_documents_project_idx").on(table.projectId)]);

export const projectActivity = pgTable("project_activity", {
  id: uuid("id").defaultRandom().primaryKey(), projectId: uuid("project_id").references(() => redevelopmentProjects.id).notNull(), actorUserId: uuid("actor_user_id").references(() => platformUsers.id),
  eventType: text("event_type").notNull(), detail: jsonb("detail").$type<Record<string, unknown>>().default({}).notNull(), visibleToRoles: jsonb("visible_to_roles").$type<Array<"society" | "developer" | "pmc" | "professional" | "admin">>().default([]).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("project_activity_project_time_idx").on(table.projectId, table.occurredAt)]);

export const platformAuditLog = pgTable("platform_audit_log", {
  id: uuid("id").defaultRandom().primaryKey(), actorUserId: uuid("actor_user_id").references(() => platformUsers.id), action: text("action").notNull(), resourceType: text("resource_type").notNull(), resourceId: uuid("resource_id").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("platform_audit_resource_idx").on(table.resourceType, table.resourceId)]);
