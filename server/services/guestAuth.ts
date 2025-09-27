import { storage } from "../storage";
import { readFileSync } from "fs";
import { join } from "path";

export const GUEST_USER = {
  id: "usr_guest_momentum_ai",
  email: "guest@momentum.ai",
  firstName: "Guest",
  lastName: "User",
  profileImageUrl: null
};

export const GUEST_PASSWORD = "MomentumGuest123!";

export function isGuestEnabled(): boolean {
  return process.env.VITE_ENABLE_GUEST === "true";
}

export function isGuestUser(email: string): boolean {
  return email === GUEST_USER.email;
}

export async function authenticateGuest(email: string, password: string): Promise<boolean> {
  if (!isGuestEnabled()) {
    return false;
  }
  
  return email === GUEST_USER.email && password === GUEST_PASSWORD;
}

export async function ensureGuestUser(): Promise<void> {
  if (!isGuestEnabled()) {
    return;
  }

  try {
    // Check if guest user already exists
    const existingUser = await storage.getUser(GUEST_USER.id);
    if (existingUser) {
      return;
    }

    // Create the guest user
    await storage.upsertUser(GUEST_USER);
    console.log('Guest user created successfully');
  } catch (error) {
    console.error('Failed to create guest user:', error);
  }
}

export interface SeedData {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    read_only: boolean;
  };
  calendar: {
    timezone: string;
    events: Array<{
      id: string;
      title: string;
      start: string;
      end: string;
      location: string;
      conference_url?: string;
      attendees: Array<{ name: string; email: string }>;
      notes: string;
      linked_account_id: string;
      linked_opportunity_id: string;
    }>;
  };
  salesforce: {
    accounts: Array<{
      id: string;
      name: string;
      domain: string;
      industry: string;
      employee_count: number;
      annual_revenue: number;
      billing_country: string;
      website: string;
      description: string;
    }>;
    contacts: Array<{
      id: string;
      account_id: string;
      first_name: string;
      last_name: string;
      title: string;
      email: string;
      phone: string;
    }>;
    opportunities: Array<{
      id: string;
      account_id: string;
      name: string;
      stage: string;
      amount: number;
      currency: string;
      close_date: string;
      owner: string;
      forecast_category: string;
      next_step: string;
      meddic: any;
      competitors: string[];
      products: Array<{ sku: string; name: string; qty: number; unit_price: number }>;
    }>;
    activities: Array<{
      id: string;
      type: string;
      subject: string;
      account_id: string;
      opportunity_id: string;
      contact_id: string;
      date: string;
      summary: string;
    }>;
  };
}

export function loadGuestSeedData(): SeedData {
  const seedPath = join(__dirname, '..', 'seeds', 'demo_guest.json');
  try {
    const seedContent = readFileSync(seedPath, 'utf-8');
    return JSON.parse(seedContent);
  } catch (error) {
    console.error('Failed to load guest seed data:', error);
    throw new Error('Could not load guest demo data');
  }
}

export async function seedGuestData(): Promise<void> {
  if (!isGuestEnabled()) {
    return;
  }

  try {
    const seedData = loadGuestSeedData();
    
    // Ensure guest user exists
    await ensureGuestUser();

    // Create companies from seed data
    for (const account of seedData.salesforce.accounts) {
      const existingCompany = await storage.getCompanyById(account.id);
      if (!existingCompany) {
        await storage.createCompany({
          name: account.name,
          domain: account.domain,
          industry: account.industry,
          size: `${account.employee_count} employees`,
          description: account.description,
          recentNews: []
        });
      }
    }

    // Create contacts from seed data
    for (const contact of seedData.salesforce.contacts) {
      const existingContact = await storage.getContactById(contact.id);
      if (!existingContact) {
        await storage.createContact({
          companyId: contact.account_id,
          email: contact.email,
          firstName: contact.first_name,
          lastName: contact.last_name,
          title: contact.title,
          role: "Stakeholder"
        });
      }
    }

    // Create calls from calendar events
    for (const event of seedData.calendar.events) {
      const existingCall = await storage.getCallById(event.id);
      if (!existingCall) {
        // Determine status based on date
        const eventDate = new Date(event.start);
        const now = new Date();
        let status = "upcoming";
        if (eventDate < now) {
          status = "completed";
        }

        await storage.createCall({
          companyId: event.linked_account_id,
          title: event.title,
          scheduledAt: eventDate,
          status,
          callType: "discovery",
          stage: "initial_discovery"
        });
      }
    }

    // Create opportunities
    for (const opportunity of seedData.salesforce.opportunities) {
      const existingOpportunity = await storage.getCrmOpportunityById(opportunity.id);
      if (!existingOpportunity) {
        await storage.createCrmOpportunity({
          companyId: opportunity.account_id,
          name: opportunity.name,
          stage: opportunity.stage,
          amount: opportunity.amount.toString(),
          probability: 50, // Default probability
          closeDate: new Date(opportunity.close_date),
          description: JSON.stringify(opportunity.meddic),
          nextStep: opportunity.next_step
        });
      }
    }

    console.log('Guest seed data loaded successfully');
  } catch (error) {
    console.error('Failed to seed guest data:', error);
  }
}

export function createGuestSession(req: any): void {
  req.user = {
    claims: {
      sub: GUEST_USER.id,
      email: GUEST_USER.email,
      first_name: GUEST_USER.firstName,
      last_name: GUEST_USER.lastName,
      profile_image_url: GUEST_USER.profileImageUrl
    }
  };
}