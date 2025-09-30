import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, boolean, numeric, integer, date, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  domain: text("domain"),
  industry: text("industry"),
  size: text("size"),
  description: text("description"),
  recentNews: jsonb("recent_news").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  title: text("title"),
  role: text("role").default("Stakeholder"),
  linkedin: text("linkedin"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const calls = pgTable("calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  title: text("title").notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: text("status").notNull().default("upcoming"), // upcoming, completed, cancelled
  callType: text("call_type"), // demo, discovery, negotiation, follow-up
  stage: text("stage"), // initial_discovery, proposal, negotiation, closed
  createdAt: timestamp("created_at").defaultNow(),
});

export const callPreps = pgTable("call_preps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callId: varchar("call_id").references(() => calls.id),
  executiveSummary: text("executive_summary"),
  crmHistory: text("crm_history"),
  competitiveLandscape: jsonb("competitive_landscape").$type<{
    primaryCompetitors: Array<{
      name: string;
      strengths: string[];
      weaknesses: string[];
      ourAdvantage: string;
    }>;
  }>(),
  conversationStrategy: text("conversation_strategy"),
  dealRisks: jsonb("deal_risks").$type<string[]>().default([]),
  immediateOpportunities: jsonb("immediate_opportunities").$type<string[]>().default([]),
  strategicExpansion: jsonb("strategic_expansion").$type<string[]>().default([]),
  isGenerated: boolean("is_generated").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// User prep notes table for persistent notes
export const prepNotes = pgTable("prep_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  eventId: varchar("event_id").notNull(), 
  text: text("text").notNull().default(''),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint for (userId, eventId) combination
  uniqueUserEvent: unique().on(table.userId, table.eventId),
}));

// Opportunities schema (for CRM sync)
export const crmOpportunities = pgTable("crm_opportunities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  stage: varchar("stage").notNull(),
  amount: numeric("amount"),
  probability: integer("probability"), // 0-100
  closeDate: date("close_date"),
  description: text("description"),
  nextStep: text("next_step"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Relations
export const companiesRelations = relations(companies, ({ many }) => ({
  contacts: many(contacts),
  calls: many(calls),
  opportunities: many(crmOpportunities),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  company: one(companies, {
    fields: [contacts.companyId],
    references: [companies.id],
  }),
}));

export const callsRelations = relations(calls, ({ one, many }) => ({
  company: one(companies, {
    fields: [calls.companyId],
    references: [companies.id],
  }),
  callPrep: one(callPreps, {
    fields: [calls.id],
    references: [callPreps.callId],
  }),
}));

export const callPrepsRelations = relations(callPreps, ({ one }) => ({
  call: one(calls, {
    fields: [callPreps.callId],
    references: [calls.id],
  }),
}));

export const crmOpportunitiesRelations = relations(crmOpportunities, ({ one }) => ({
  company: one(companies, {
    fields: [crmOpportunities.companyId],
    references: [companies.id],
  }),
}));

// Insert schemas
export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
});

export const insertCallSchema = createInsertSchema(calls).omit({
  id: true,
  createdAt: true,
});

export const insertCallPrepSchema = createInsertSchema(callPreps).omit({
  id: true,
  createdAt: true,
});

export const insertCrmOpportunitySchema = createInsertSchema(crmOpportunities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

export type Call = typeof calls.$inferSelect;
export type InsertCall = z.infer<typeof insertCallSchema>;

export type CallPrep = typeof callPreps.$inferSelect;
export type InsertCallPrep = z.infer<typeof insertCallPrepSchema>;

export type CrmOpportunity = typeof crmOpportunities.$inferSelect;
export type InsertCrmOpportunity = z.infer<typeof insertCrmOpportunitySchema>;

// Integration tables for external services
export const integrations = pgTable("integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // 'salesforce', 'hubspot', 'google_calendar', etc.
  type: text("type").notNull(), // 'crm', 'calendar', 'email', 'conversation'
  status: text("status").notNull().default("inactive"), // 'active', 'inactive', 'error'
  config: jsonb("config").$type<Record<string, any>>().default({}),
  credentials: jsonb("credentials").$type<Record<string, any>>().default({}),
  lastSyncAt: timestamp("last_sync_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const integrationData = pgTable("integration_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  integrationId: varchar("integration_id").references(() => integrations.id),
  externalId: text("external_id").notNull(), // ID from external system
  dataType: text("data_type").notNull(), // 'company', 'contact', 'call', 'email'
  data: jsonb("data").$type<Record<string, any>>().notNull(),
  localId: varchar("local_id"), // Reference to local entity ID
  lastSyncAt: timestamp("last_sync_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [
    // Add index for session expiration
    sql`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON ${table} (${table.expire})`
  ]
);

// User storage table for Replit Auth.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Google integrations table to store OAuth tokens
export const googleIntegrations = pgTable("google_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiry: timestamp("token_expiry"),
  scopes: jsonb("scopes").$type<string[]>().default([]),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Salesforce integrations table to store OAuth tokens
export const salesforceIntegrations = pgTable("salesforce_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  instanceUrl: text("instance_url").notNull(), // Salesforce instance URL
  tokenExpiry: timestamp("token_expiry"),
  // scopes: jsonb("scopes").$type<string[]>().default([]), // Temporarily disabled for migration
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Integration schemas
export const insertIntegrationSchema = createInsertSchema(integrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIntegrationDataSchema = createInsertSchema(integrationData).omit({
  id: true,
  createdAt: true,
});

export const insertGoogleIntegrationSchema = createInsertSchema(googleIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSalesforceIntegrationSchema = createInsertSchema(salesforceIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type GoogleIntegration = typeof googleIntegrations.$inferSelect;
export type InsertGoogleIntegration = z.infer<typeof insertGoogleIntegrationSchema>;

export type SalesforceIntegration = typeof salesforceIntegrations.$inferSelect;
export type InsertSalesforceIntegration = z.infer<typeof insertSalesforceIntegrationSchema>;

// User schemas for Replit Auth
export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

// Integration types
export type Integration = typeof integrations.$inferSelect;
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;

export type IntegrationData = typeof integrationData.$inferSelect;
export type InsertIntegrationData = z.infer<typeof insertIntegrationDataSchema>;

// User types for Replit Auth
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Prep notes schemas and types
export const insertPrepNoteSchema = createInsertSchema(prepNotes).omit({
  id: true,
  updatedAt: true,
});

export type PrepNote = typeof prepNotes.$inferSelect;
export type InsertPrepNote = z.infer<typeof insertPrepNoteSchema>;

// Sales Coach tables
export const coachSessions = pgTable("coach_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventId: varchar("event_id").notNull(), // Google Calendar event ID
  status: text("status").notNull().default("idle"), // idle, connecting, listening, ended, error
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const coachTranscripts = pgTable("coach_transcripts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => coachSessions.id, { onDelete: 'cascade' }),
  at: timestamp("at").notNull().defaultNow(),
  speaker: text("speaker").notNull(), // "rep", "prospect", "system"
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const coachSuggestions = pgTable("coach_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => coachSessions.id, { onDelete: 'cascade' }),
  at: timestamp("at").notNull().defaultNow(),
  type: text("type").notNull(), // "suggestion", "objection", "knowledge"
  priority: text("priority").notNull().default("medium"), // "low", "medium", "high"
  title: text("title").notNull(),
  body: text("body").notNull(),
  customerQuote: text("customer_quote"), // For objection handling
  recommendedResponse: text("recommended_response"), // For objection handling
  resolved: boolean("resolved").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Sales Coach relations
export const coachSessionsRelations = relations(coachSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [coachSessions.userId],
    references: [users.id],
  }),
  transcripts: many(coachTranscripts),
  suggestions: many(coachSuggestions),
}));

export const coachTranscriptsRelations = relations(coachTranscripts, ({ one }) => ({
  session: one(coachSessions, {
    fields: [coachTranscripts.sessionId],
    references: [coachSessions.id],
  }),
}));

export const coachSuggestionsRelations = relations(coachSuggestions, ({ one }) => ({
  session: one(coachSessions, {
    fields: [coachSuggestions.sessionId],
    references: [coachSessions.id],
  }),
}));

// Sales Coach insert schemas
export const insertCoachSessionSchema = createInsertSchema(coachSessions).omit({
  id: true,
  createdAt: true,
});

export const insertCoachTranscriptSchema = createInsertSchema(coachTranscripts).omit({
  id: true,
  createdAt: true,
});

export const insertCoachSuggestionSchema = createInsertSchema(coachSuggestions).omit({
  id: true,
  createdAt: true,
});

// Sales Coach types
export type CoachSession = typeof coachSessions.$inferSelect;
export type InsertCoachSession = z.infer<typeof insertCoachSessionSchema>;

export type CoachTranscript = typeof coachTranscripts.$inferSelect;
export type InsertCoachTranscript = z.infer<typeof insertCoachTranscriptSchema>;

export type CoachSuggestion = typeof coachSuggestions.$inferSelect;
export type InsertCoachSuggestion = z.infer<typeof insertCoachSuggestionSchema>;

// Call Transcripts table for Silent Call Recorder MVP
export const callTranscripts = pgTable("call_transcripts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventId: varchar("event_id").notNull(), // Google Calendar event ID
  companyId: varchar("company_id").references(() => companies.id, { onDelete: 'set null' }),
  opportunityId: varchar("opportunity_id").references(() => crmOpportunities.id, { onDelete: 'set null' }),
  transcript: text("transcript").notNull(), // Final transcript text only
  eventTitle: text("event_title"), // Cache of event title for easy reference
  eventStartTime: timestamp("event_start_time"), // Cache of event start time
  duration: integer("duration"), // Call duration in seconds
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Call Transcripts relations
export const callTranscriptsRelations = relations(callTranscripts, ({ one }) => ({
  user: one(users, {
    fields: [callTranscripts.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [callTranscripts.companyId],
    references: [companies.id],
  }),
  opportunity: one(crmOpportunities, {
    fields: [callTranscripts.opportunityId],
    references: [crmOpportunities.id],
  }),
}));

// Call Transcripts insert schema
export const insertCallTranscriptSchema = createInsertSchema(callTranscripts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Call Transcripts types
export type CallTranscript = typeof callTranscripts.$inferSelect;
export type InsertCallTranscript = z.infer<typeof insertCallTranscriptSchema>;

// Chat Sessions and Messages for unified Opus chat across web app and extension
export const chatSessions = pgTable("chat_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  conversationId: varchar("conversation_id").notNull().unique(), // Client-side generated UUID
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
  messageId: varchar("message_id").notNull(), // Client-side generated UUID
  role: text("role").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Unique constraint to prevent message duplication
  uniqueSessionMessage: unique().on(table.sessionId, table.messageId),
}));

// Chat relations
export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [chatSessions.userId],
    references: [users.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.id],
  }),
}));

// Chat insert schemas
export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

// Chat types
export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
