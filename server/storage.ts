import { 
  companies, contacts, calls, callPreps, users, integrations, integrationData, crmOpportunities, googleIntegrations, salesforceIntegrations,
  type Company, type InsertCompany,
  type Contact, type InsertContact,
  type Call, type InsertCall,
  type CallPrep, type InsertCallPrep,
  type User, type UpsertUser,
  type Integration, type InsertIntegration,
  type IntegrationData, type InsertIntegrationData,
  type CrmOpportunity, type InsertCrmOpportunity,
  type GoogleIntegration, type InsertGoogleIntegration,
  type SalesforceIntegration, type InsertSalesforceIntegration
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import { CryptoService } from "./services/crypto";

export interface IStorage {
  // User methods for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Legacy user methods (keeping for compatibility)
  getUserByUsername?(username: string): Promise<User | undefined>;
  createUser?(user: UpsertUser): Promise<User>;

  // Company methods
  createCompany(company: InsertCompany): Promise<Company>;
  getCompany(id: string): Promise<Company | undefined>;
  getCompanyByDomain(domain: string): Promise<Company | undefined>;
  updateCompany(id: string, updates: Partial<InsertCompany>): Promise<Company>;

  // Contact methods
  createContact(contact: InsertContact): Promise<Contact>;
  getContactsByCompany(companyId: string): Promise<Contact[]>;
  updateContact(id: string, updates: Partial<InsertContact>): Promise<Contact>;

  // Call methods
  createCall(call: InsertCall): Promise<Call>;
  getCall(id: string): Promise<Call | undefined>;
  getCallsWithCompany(): Promise<Array<Call & { company: Company }>>;
  getUpcomingCalls(): Promise<Array<Call & { company: Company }>>;
  getPreviousCalls(): Promise<Array<Call & { company: Company }>>;
  updateCallStatus(id: string, status: string): Promise<void>;
  updateCall(id: string, updates: Partial<InsertCall>): Promise<Call>;

  // Opportunity methods
  createOpportunity(opportunity: InsertCrmOpportunity): Promise<CrmOpportunity>;
  getOpportunitiesByCompany(companyId: string): Promise<CrmOpportunity[]>;
  updateOpportunity(id: string, updates: Partial<InsertCrmOpportunity>): Promise<CrmOpportunity>;

  // Call prep methods
  createCallPrep(callPrep: InsertCallPrep): Promise<CallPrep>;
  getCallPrep(callId: string): Promise<CallPrep | undefined>;
  updateCallPrep(callId: string, updates: Partial<InsertCallPrep>): Promise<CallPrep>;

  // Integration methods
  createIntegration(integration: InsertIntegration): Promise<Integration>;
  getIntegration(id: string): Promise<Integration | undefined>;
  getIntegrationByName(name: string): Promise<Integration | undefined>;
  updateIntegration(id: string, updates: Partial<InsertIntegration>): Promise<Integration>;
  deleteIntegration(id: string): Promise<void>;
  getAllIntegrations(): Promise<Integration[]>;

  // Integration data methods
  createIntegrationData(data: InsertIntegrationData): Promise<IntegrationData>;
  getIntegrationData(integrationId: string, dataType: string): Promise<IntegrationData[]>;
  getIntegrationDataByExternalId(
    integrationId: string,
    dataType: string,
    externalId: string
  ): Promise<IntegrationData | undefined>;
  updateIntegrationData(id: string, updates: Partial<InsertIntegrationData>): Promise<IntegrationData>;
  deleteIntegrationData(integrationId: string, externalId: string): Promise<void>;

  // Google integration methods
  createGoogleIntegration(googleIntegration: InsertGoogleIntegration): Promise<GoogleIntegration>;
  getGoogleIntegration(userId: string): Promise<GoogleIntegration | undefined>;
  updateGoogleIntegration(userId: string, updates: Partial<InsertGoogleIntegration>): Promise<GoogleIntegration>;
  deleteGoogleIntegration(userId: string): Promise<void>;

  // Salesforce integration methods
  createSalesforceIntegration(salesforceIntegration: InsertSalesforceIntegration): Promise<SalesforceIntegration>;
  getSalesforceIntegration(userId: string): Promise<SalesforceIntegration | undefined>;
  updateSalesforceIntegration(userId: string, updates: Partial<InsertSalesforceIntegration>): Promise<SalesforceIntegration>;
  deleteSalesforceIntegration(userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User methods for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Legacy user methods (kept for compatibility)
  async getUserByUsername(username: string): Promise<User | undefined> {
    // Note: username field may not exist in new schema
    return undefined;
  }

  async createUser(insertUser: UpsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Company methods
  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const [company] = await db.insert(companies).values(insertCompany).returning();
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

  async updateCompany(id: string, updates: Partial<InsertCompany>): Promise<Company> {
    const [company] = await db
      .update(companies)
      .set(updates)
      .where(eq(companies.id, id))
      .returning();
    return company;
  }

  // Contact methods
  async createContact(insertContact: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(insertContact).returning();
    return contact;
  }

  async getContactsByCompany(companyId: string): Promise<Contact[]> {
    return await db.select().from(contacts).where(eq(contacts.companyId, companyId));
  }

  async updateContact(id: string, updates: Partial<InsertContact>): Promise<Contact> {
    const [contact] = await db
      .update(contacts)
      .set(updates)
      .where(eq(contacts.id, id))
      .returning();
    return contact;
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

  async updateCall(id: string, updates: Partial<InsertCall>): Promise<Call> {
    const [call] = await db
      .update(calls)
      .set(updates)
      .where(eq(calls.id, id))
      .returning();
    return call;
  }

  // Opportunity methods
  async createOpportunity(insertOpportunity: InsertCrmOpportunity): Promise<CrmOpportunity> {
    const [opportunity] = await db.insert(crmOpportunities).values(insertOpportunity).returning();
    return opportunity;
  }

  async getOpportunitiesByCompany(companyId: string): Promise<CrmOpportunity[]> {
    return await db.select().from(crmOpportunities).where(eq(crmOpportunities.companyId, companyId));
  }

  async updateOpportunity(id: string, updates: Partial<InsertCrmOpportunity>): Promise<CrmOpportunity> {
    const [opportunity] = await db
      .update(crmOpportunities)
      .set(updates)
      .where(eq(crmOpportunities.id, id))
      .returning();
    return opportunity;
  }

  // Call prep methods
  async createCallPrep(insertCallPrep: InsertCallPrep): Promise<CallPrep> {
    const [callPrep] = await db.insert(callPreps).values(insertCallPrep).returning();
    return callPrep;
  }

  async getCallPrep(callId: string): Promise<CallPrep | undefined> {
    const [callPrep] = await db.select().from(callPreps).where(eq(callPreps.callId, callId));
    return callPrep || undefined;
  }

  async updateCallPrep(callId: string, updates: Partial<InsertCallPrep>): Promise<CallPrep> {
    const [callPrep] = await db
      .update(callPreps)
      .set(updates)
      .where(eq(callPreps.callId, callId))
      .returning();
    return callPrep;
  }

  // Integration methods
  async createIntegration(insertIntegration: InsertIntegration): Promise<Integration> {
    const [integration] = await db.insert(integrations).values(insertIntegration).returning();
    return integration;
  }

  async getIntegration(id: string): Promise<Integration | undefined> {
    const [integration] = await db.select().from(integrations).where(eq(integrations.id, id));
    return integration || undefined;
  }

  async getIntegrationByName(name: string): Promise<Integration | undefined> {
    const [integration] = await db.select().from(integrations).where(eq(integrations.name, name));
    return integration || undefined;
  }

  async updateIntegration(id: string, updates: Partial<InsertIntegration>): Promise<Integration> {
    const [integration] = await db
      .update(integrations)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(eq(integrations.id, id))
      .returning();
    return integration;
  }

  async deleteIntegration(id: string): Promise<void> {
    await db.delete(integrations).where(eq(integrations.id, id));
  }

  async getAllIntegrations(): Promise<Integration[]> {
    return await db.select().from(integrations);
  }

  // Integration data methods
  async createIntegrationData(insertData: InsertIntegrationData): Promise<IntegrationData> {
    const [data] = await db.insert(integrationData).values(insertData).returning();
    return data;
  }

  async getIntegrationData(integrationId: string, dataType: string): Promise<IntegrationData[]> {
    return await db
      .select()
      .from(integrationData)
      .where(and(
        eq(integrationData.integrationId, integrationId),
        eq(integrationData.dataType, dataType)
      ));
  }

  async getIntegrationDataByExternalId(
    integrationId: string,
    dataType: string,
    externalId: string
  ): Promise<IntegrationData | undefined> {
    const [data] = await db
      .select()
      .from(integrationData)
      .where(and(
        eq(integrationData.integrationId, integrationId),
        eq(integrationData.dataType, dataType),
        eq(integrationData.externalId, externalId)
      ));

    return data || undefined;
  }

  async updateIntegrationData(id: string, updates: Partial<InsertIntegrationData>): Promise<IntegrationData> {
    const [data] = await db
      .update(integrationData)
      .set(updates as any)
      .where(eq(integrationData.id, id))
      .returning();
    return data;
  }

  async deleteIntegrationData(integrationId: string, externalId: string): Promise<void> {
    await db
      .delete(integrationData)
      .where(and(
        eq(integrationData.integrationId, integrationId),
        eq(integrationData.externalId, externalId)
      ));
  }

  // Google integration methods
  async createGoogleIntegration(insertGoogleIntegration: InsertGoogleIntegration): Promise<GoogleIntegration> {
    // Encrypt tokens before storing
    const encryptedData = { ...insertGoogleIntegration };
    if (encryptedData.accessToken) {
      encryptedData.accessToken = JSON.stringify(CryptoService.encrypt(encryptedData.accessToken));
    }
    if (encryptedData.refreshToken) {
      encryptedData.refreshToken = JSON.stringify(CryptoService.encrypt(encryptedData.refreshToken));
    }
    
    const [googleIntegration] = await db.insert(googleIntegrations).values(encryptedData).returning();
    return this.decryptGoogleIntegrationTokens(googleIntegration);
  }

  async getGoogleIntegration(userId: string): Promise<GoogleIntegration | undefined> {
    const [googleIntegration] = await db
      .select()
      .from(googleIntegrations)
      .where(and(
        eq(googleIntegrations.userId, userId),
        eq(googleIntegrations.isActive, true)
      ));
    
    if (!googleIntegration) return undefined;
    
    return this.decryptGoogleIntegrationTokens(googleIntegration);
  }

  async updateGoogleIntegration(userId: string, updates: Partial<InsertGoogleIntegration>): Promise<GoogleIntegration> {
    // Encrypt tokens before updating
    const encryptedUpdates = { ...updates };
    if (encryptedUpdates.accessToken) {
      encryptedUpdates.accessToken = JSON.stringify(CryptoService.encrypt(encryptedUpdates.accessToken));
    }
    if (encryptedUpdates.refreshToken) {
      encryptedUpdates.refreshToken = JSON.stringify(CryptoService.encrypt(encryptedUpdates.refreshToken));
    }
    
    const [googleIntegration] = await db
      .update(googleIntegrations)
      .set({ ...encryptedUpdates, updatedAt: new Date() } as any)
      .where(eq(googleIntegrations.userId, userId))
      .returning();
    return this.decryptGoogleIntegrationTokens(googleIntegration);
  }

  // Helper method to decrypt tokens from database
  private decryptGoogleIntegrationTokens(googleIntegration: GoogleIntegration): GoogleIntegration {
    const decrypted = { ...googleIntegration };
    
    try {
      if (decrypted.accessToken) {
        // Check if it's already encrypted
        try {
          const encryptedData = JSON.parse(decrypted.accessToken);
          if (CryptoService.isEncrypted(encryptedData)) {
            decrypted.accessToken = CryptoService.decrypt(encryptedData);
          }
        } catch (e) {
          // Token is not encrypted or JSON, leave as is
        }
      }
      
      if (decrypted.refreshToken) {
        // Check if it's already encrypted
        try {
          const encryptedData = JSON.parse(decrypted.refreshToken);
          if (CryptoService.isEncrypted(encryptedData)) {
            decrypted.refreshToken = CryptoService.decrypt(encryptedData);
          }
        } catch (e) {
          // Token is not encrypted or JSON, leave as is
        }
      }
    } catch (error) {
      console.error('Error decrypting Google integration tokens:', error);
      // Return the integration without decrypting if there's an error
      // This allows for graceful handling of legacy data
    }
    
    return decrypted;
  }

  async deleteGoogleIntegration(userId: string): Promise<void> {
    await db
      .update(googleIntegrations)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(googleIntegrations.userId, userId));
  }

  // Salesforce integration methods
  async createSalesforceIntegration(insertSalesforceIntegration: InsertSalesforceIntegration): Promise<SalesforceIntegration> {
    // Encrypt tokens before storing
    const encryptedData = { ...insertSalesforceIntegration };
    if (encryptedData.accessToken) {
      encryptedData.accessToken = JSON.stringify(CryptoService.encrypt(encryptedData.accessToken));
    }
    if (encryptedData.refreshToken) {
      encryptedData.refreshToken = JSON.stringify(CryptoService.encrypt(encryptedData.refreshToken));
    }
    
    const [salesforceIntegration] = await db.insert(salesforceIntegrations).values(encryptedData).returning();
    return this.decryptSalesforceIntegrationTokens(salesforceIntegration);
  }

  async getSalesforceIntegration(userId: string): Promise<SalesforceIntegration | undefined> {
    const [salesforceIntegration] = await db
      .select()
      .from(salesforceIntegrations)
      .where(and(
        eq(salesforceIntegrations.userId, userId),
        eq(salesforceIntegrations.isActive, true)
      ));
    
    if (!salesforceIntegration) return undefined;
    
    return this.decryptSalesforceIntegrationTokens(salesforceIntegration);
  }

  async updateSalesforceIntegration(userId: string, updates: Partial<InsertSalesforceIntegration>): Promise<SalesforceIntegration> {
    // Encrypt tokens before updating
    const encryptedUpdates = { ...updates };
    if (encryptedUpdates.accessToken) {
      encryptedUpdates.accessToken = JSON.stringify(CryptoService.encrypt(encryptedUpdates.accessToken));
    }
    if (encryptedUpdates.refreshToken) {
      encryptedUpdates.refreshToken = JSON.stringify(CryptoService.encrypt(encryptedUpdates.refreshToken));
    }
    
    const [salesforceIntegration] = await db
      .update(salesforceIntegrations)
      .set({ ...encryptedUpdates, updatedAt: new Date() } as any)
      .where(eq(salesforceIntegrations.userId, userId))
      .returning();
    return this.decryptSalesforceIntegrationTokens(salesforceIntegration);
  }

  async deleteSalesforceIntegration(userId: string): Promise<void> {
    await db
      .update(salesforceIntegrations)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(salesforceIntegrations.userId, userId));
  }

  private decryptSalesforceIntegrationTokens(salesforceIntegration: SalesforceIntegration): SalesforceIntegration {
    const decrypted = { ...salesforceIntegration };
    
    try {
      if (decrypted.accessToken) {
        // Check if it's already encrypted
        try {
          const encryptedData = JSON.parse(decrypted.accessToken);
          if (CryptoService.isEncrypted(encryptedData)) {
            decrypted.accessToken = CryptoService.decrypt(encryptedData);
          }
        } catch (e) {
          // Token is not encrypted or JSON, leave as is
        }
      }
      
      if (decrypted.refreshToken) {
        // Check if it's already encrypted
        try {
          const encryptedData = JSON.parse(decrypted.refreshToken);
          if (CryptoService.isEncrypted(encryptedData)) {
            decrypted.refreshToken = CryptoService.decrypt(encryptedData);
          }
        } catch (e) {
          // Token is not encrypted or JSON, leave as is
        }
      }
      
      // Temporarily add empty scopes array for compatibility until schema migration
      if (!decrypted.scopes) {
        (decrypted as any).scopes = [];
      }
    } catch (error) {
      console.error('Error decrypting Salesforce integration tokens:', error);
      // Return the integration without decrypting if there's an error
      // This allows for graceful handling of legacy data
    }
    
    return decrypted;
  }
}

export const storage = new DatabaseStorage();
