import { IStorage } from "../storage";
import type { Company, Contact } from "@shared/schema";

// Calendar event structure (from Google Calendar API)
export interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
}

// Resolution result with confidence scoring
export interface AccountMatch {
  company?: Company;
  contacts: Contact[];
  confidence: number; // 0-100
  matchType: 'exact_email' | 'domain_match' | 'fuzzy_name' | 'no_match';
  matchDetails: string;
}

export class AccountResolver {
  constructor(private storage: IStorage) {}

  /**
   * Resolves a calendar event to company/contact matches with confidence scoring
   */
  async resolve(event: CalendarEvent): Promise<AccountMatch> {
    console.log(`[AccountResolver] Resolving event: ${event.summary}`);
    
    // Strategy 1: Exact email matching (highest confidence)
    const emailMatch = await this.tryEmailMatching(event);
    if (emailMatch) {
      console.log(`[AccountResolver] Found exact email match: ${emailMatch.matchDetails}`);
      return emailMatch;
    }

    // Strategy 2: Domain matching (medium confidence)
    const domainMatch = await this.tryDomainMatching(event);
    if (domainMatch) {
      console.log(`[AccountResolver] Found domain match: ${domainMatch.matchDetails}`);
      return domainMatch;
    }

    // Strategy 3: Fuzzy name matching (lower confidence)
    const nameMatch = await this.tryFuzzyNameMatching(event);
    if (nameMatch) {
      console.log(`[AccountResolver] Found fuzzy name match: ${nameMatch.matchDetails}`);
      return nameMatch;
    }

    // No matches found
    console.log(`[AccountResolver] No matches found for event: ${event.summary}`);
    return {
      contacts: [],
      confidence: 0,
      matchType: 'no_match',
      matchDetails: 'No matching company or contacts found'
    };
  }

  /**
   * Strategy 1: Match attendee emails directly against contact emails
   */
  private async tryEmailMatching(event: CalendarEvent): Promise<AccountMatch | null> {
    if (!event.attendees?.length) return null;

    for (const attendee of event.attendees) {
      try {
        // Get all contacts to search (in real app, you'd optimize this)
        const companies = await this.getAllCompaniesWithContacts();
        
        for (const company of companies) {
          const matchingContact = company.contacts?.find(
            contact => contact.email.toLowerCase() === attendee.email.toLowerCase()
          );
          
          if (matchingContact) {
            // Found exact email match
            const allCompanyContacts = company.contacts || [];
            return {
              company,
              contacts: allCompanyContacts,
              confidence: 95,
              matchType: 'exact_email',
              matchDetails: `Matched attendee ${attendee.email} to ${company.name}`
            };
          }
        }
      } catch (error) {
        console.error(`[AccountResolver] Error in email matching:`, error);
      }
    }

    return null;
  }

  /**
   * Strategy 2: Match email domains against company domains
   */
  private async tryDomainMatching(event: CalendarEvent): Promise<AccountMatch | null> {
    if (!event.attendees?.length) return null;

    for (const attendee of event.attendees) {
      const domain = this.extractDomain(attendee.email);
      if (!domain || this.isGenericDomain(domain)) continue;

      try {
        // Try to find company by domain
        const company = await this.storage.getCompanyByDomain(domain);
        if (company) {
          // Get contacts for this company
          const contacts = await this.storage.getContactsByCompany(company.id);
          return {
            company,
            contacts,
            confidence: 75,
            matchType: 'domain_match',
            matchDetails: `Matched domain ${domain} to ${company.name}`
          };
        }
      } catch (error) {
        console.error(`[AccountResolver] Error in domain matching:`, error);
      }
    }

    return null;
  }

  /**
   * Strategy 3: Fuzzy matching of meeting title against company names
   */
  private async tryFuzzyNameMatching(event: CalendarEvent): Promise<AccountMatch | null> {
    if (!event.summary?.trim()) return null;

    try {
      const companies = await this.getAllCompaniesWithContacts();
      const title = event.summary.toLowerCase();
      
      for (const company of companies) {
        const companyName = company.name.toLowerCase();
        
        // Simple fuzzy matching - check if company name is in meeting title
        if (title.includes(companyName) || companyName.includes(title)) {
          const contacts = company.contacts || [];
          return {
            company,
            contacts,
            confidence: 40,
            matchType: 'fuzzy_name',
            matchDetails: `Matched meeting title "${event.summary}" to ${company.name}`
          };
        }
      }
    } catch (error) {
      console.error(`[AccountResolver] Error in fuzzy name matching:`, error);
    }

    return null;
  }

  /**
   * Helper: Get all companies with their contacts (for small datasets)
   */
  private async getAllCompaniesWithContacts(): Promise<Array<Company & { contacts?: Contact[] }>> {
    try {
      // In a real app, you'd optimize this with proper joins
      const allCalls = await this.storage.getCallsWithCompany();
      const companies = allCalls.map(call => call.company);
      
      // Deduplicate companies
      const uniqueCompanies = companies.filter((company, index, self) => 
        self.findIndex(c => c.id === company.id) === index
      );

      // Add contacts to each company
      const companiesWithContacts = await Promise.all(
        uniqueCompanies.map(async (company) => {
          try {
            const contacts = await this.storage.getContactsByCompany(company.id);
            return { ...company, contacts };
          } catch (error) {
            console.error(`[AccountResolver] Error fetching contacts for ${company.name}:`, error);
            return { ...company, contacts: [] };
          }
        })
      );

      return companiesWithContacts;
    } catch (error) {
      console.error(`[AccountResolver] Error getting companies with contacts:`, error);
      return [];
    }
  }

  /**
   * Helper: Extract domain from email address
   */
  private extractDomain(email: string): string | null {
    try {
      const match = email.match(/@([^.]+\.[^.]+)$/);
      return match ? match[1].toLowerCase() : null;
    } catch {
      return null;
    }
  }

  /**
   * Helper: Check if domain is too generic for meaningful matching
   */
  private isGenericDomain(domain: string): boolean {
    const genericDomains = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
      'aol.com', 'icloud.com', 'live.com', 'msn.com'
    ];
    return genericDomains.includes(domain.toLowerCase());
  }
}