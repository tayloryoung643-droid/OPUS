import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
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

// Relations
export const companiesRelations = relations(companies, ({ many }) => ({
  contacts: many(contacts),
  calls: many(calls),
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

// Types
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

export type Call = typeof calls.$inferSelect;
export type InsertCall = z.infer<typeof insertCallSchema>;

export type CallPrep = typeof callPreps.$inferSelect;
export type InsertCallPrep = z.infer<typeof insertCallPrepSchema>;

// Legacy user schema for compatibility
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
