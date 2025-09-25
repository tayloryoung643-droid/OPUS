import { 
  companies, contacts, calls, callPreps, users,
  type Company, type InsertCompany,
  type Contact, type InsertContact,
  type Call, type InsertCall,
  type CallPrep, type InsertCallPrep,
  type User, type InsertUser
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // Legacy user methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Company methods
  createCompany(company: InsertCompany): Promise<Company>;
  getCompany(id: string): Promise<Company | undefined>;
  getCompanyByDomain(domain: string): Promise<Company | undefined>;

  // Contact methods
  createContact(contact: InsertContact): Promise<Contact>;
  getContactsByCompany(companyId: string): Promise<Contact[]>;

  // Call methods
  createCall(call: InsertCall): Promise<Call>;
  getCall(id: string): Promise<Call | undefined>;
  getCallsWithCompany(): Promise<Array<Call & { company: Company }>>;
  getUpcomingCalls(): Promise<Array<Call & { company: Company }>>;
  getPreviousCalls(): Promise<Array<Call & { company: Company }>>;
  updateCallStatus(id: string, status: string): Promise<void>;

  // Call prep methods
  createCallPrep(callPrep: InsertCallPrep): Promise<CallPrep>;
  getCallPrep(callId: string): Promise<CallPrep | undefined>;
  updateCallPrep(callId: string, updates: Partial<InsertCallPrep>): Promise<CallPrep>;
}

export class DatabaseStorage implements IStorage {
  // Legacy user methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Company methods
  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const [company] = await db.insert(companies).values([insertCompany]).returning();
    return company;
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company || undefined;
  }

  async getCompanyByDomain(domain: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.domain, domain));
    return company || undefined;
  }

  // Contact methods
  async createContact(insertContact: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(insertContact).returning();
    return contact;
  }

  async getContactsByCompany(companyId: string): Promise<Contact[]> {
    return await db.select().from(contacts).where(eq(contacts.companyId, companyId));
  }

  // Call methods
  async createCall(insertCall: InsertCall): Promise<Call> {
    const [call] = await db.insert(calls).values(insertCall).returning();
    return call;
  }

  async getCall(id: string): Promise<Call | undefined> {
    const [call] = await db.select().from(calls).where(eq(calls.id, id));
    return call || undefined;
  }

  async getCallsWithCompany(): Promise<Array<Call & { company: Company }>> {
    const result = await db
      .select()
      .from(calls)
      .leftJoin(companies, eq(calls.companyId, companies.id))
      .orderBy(desc(calls.scheduledAt));

    return result.map(row => ({
      ...row.calls,
      company: row.companies!
    }));
  }

  async getUpcomingCalls(): Promise<Array<Call & { company: Company }>> {
    const result = await db
      .select()
      .from(calls)
      .leftJoin(companies, eq(calls.companyId, companies.id))
      .where(eq(calls.status, "upcoming"))
      .orderBy(calls.scheduledAt);

    return result.map(row => ({
      ...row.calls,
      company: row.companies!
    }));
  }

  async getPreviousCalls(): Promise<Array<Call & { company: Company }>> {
    const result = await db
      .select()
      .from(calls)
      .leftJoin(companies, eq(calls.companyId, companies.id))
      .where(eq(calls.status, "completed"))
      .orderBy(desc(calls.scheduledAt));

    return result.map(row => ({
      ...row.calls,
      company: row.companies!
    }));
  }

  async updateCallStatus(id: string, status: string): Promise<void> {
    await db.update(calls).set({ status }).where(eq(calls.id, id));
  }

  // Call prep methods
  async createCallPrep(insertCallPrep: InsertCallPrep): Promise<CallPrep> {
    const [callPrep] = await db.insert(callPreps).values([insertCallPrep]).returning();
    return callPrep;
  }

  async getCallPrep(callId: string): Promise<CallPrep | undefined> {
    const [callPrep] = await db.select().from(callPreps).where(eq(callPreps.callId, callId));
    return callPrep || undefined;
  }

  async updateCallPrep(callId: string, updates: Partial<InsertCallPrep>): Promise<CallPrep> {
    const [callPrep] = await db
      .update(callPreps)
      .set(updates as any)
      .where(eq(callPreps.callId, callId))
      .returning();
    return callPrep;
  }
}

export const storage = new DatabaseStorage();
