/**
 * Call Context Analyzer Service
 * Extracts context from CRM data, calendar events, and call information
 * to determine optimal sales methodology approach
 */

import type { CallContext } from './salesMethodologies';
import type { Call, Company, Contact } from '@shared/schema';

export interface AnalysisInputs {
  call?: Call & { company: Company };
  calendarEvent?: any;
  crmData?: {
    opportunity?: any;
    account?: any;
    contacts?: Contact[];
  };
  additionalContext?: {
    previousInteractions?: string[];
    knownPainPoints?: string[];
    competitorIntel?: string[];
  };
}

/**
 * Analyze call context from available data sources
 */
export async function analyzeCallContext(inputs: AnalysisInputs): Promise<CallContext> {
  const { call, calendarEvent, crmData, additionalContext } = inputs;

  // Determine call type from calendar event title and call data
  const callType = determineCallType(call, calendarEvent);
  
  // Determine deal stage from call stage or CRM opportunity data
  const dealStage = determineDealStage(call, crmData?.opportunity);
  
  // Extract deal value from call or CRM data
  const dealValue = extractDealValue(call, crmData?.opportunity);
  
  // Determine industry from company data
  const industry = call?.company?.industry || crmData?.account?.industry;
  
  // Analyze company size from various signals
  const companySize = determineCompanySize(call?.company, crmData?.account);
  
  // Assess sales cycle length based on deal characteristics
  const salesCycle = assessSalesCycle(dealValue, industry, companySize);
  
  // Determine complexity from multiple factors
  const complexity = assessComplexity(dealValue, industry, companySize, crmData?.contacts?.length);
  
  // Check if this is new business vs expansion
  const isNewBusiness = assessIsNewBusiness(call, crmData, additionalContext);

  return {
    callType,
    dealStage,
    dealValue,
    industry,
    companySize,
    salesCycle,
    complexity,
    isNewBusiness
  };
}

/**
 * Determine call type from title and context clues
 */
function determineCallType(
  call?: Call & { company: Company }, 
  calendarEvent?: any
): CallContext['callType'] {
  const title = calendarEvent?.summary?.toLowerCase() || call?.title?.toLowerCase() || '';
  const callType = call?.callType?.toLowerCase() || '';

  // Check for explicit call type indicators
  if (title.includes('discovery') || title.includes('intake') || callType.includes('discovery')) {
    return 'discovery';
  }
  
  if (title.includes('demo') || title.includes('presentation') || title.includes('walkthrough')) {
    return 'demo';
  }
  
  if (title.includes('proposal') || title.includes('quote') || title.includes('pricing')) {
    return 'proposal';
  }
  
  if (title.includes('negotiation') || title.includes('contract') || title.includes('terms')) {
    return 'negotiation';
  }
  
  if (title.includes('close') || title.includes('signature') || title.includes('final')) {
    return 'closing';
  }
  
  if (title.includes('followup') || title.includes('follow up') || title.includes('check in')) {
    return 'followup';
  }

  // Default to discovery for new relationships, demo for ongoing
  return call?.stage === 'scheduled' || !call ? 'discovery' : 'demo';
}

/**
 * Determine deal stage from available data
 */
function determineDealStage(
  call?: Call & { company: Company }, 
  opportunity?: any
): CallContext['dealStage'] {
  // Use CRM opportunity stage if available
  if (opportunity?.stage) {
    const stage = opportunity.stage.toLowerCase();
    if (stage.includes('prospect')) return 'prospecting';
    if (stage.includes('qualify') || stage.includes('discovery')) return 'qualifying';
    if (stage.includes('develop') || stage.includes('needs') || stage.includes('analysis')) return 'developing';
    if (stage.includes('proposal') || stage.includes('quote')) return 'proposing';
    if (stage.includes('negotiat') || stage.includes('contract')) return 'negotiating';
    if (stage.includes('closed') || stage.includes('won')) return 'closed';
  }

  // Use call stage as fallback
  const callStage = call?.stage?.toLowerCase();
  if (callStage === 'completed') return 'closed';
  if (callStage === 'scheduled') return 'prospecting';

  // Default based on call type
  return 'qualifying';
}

/**
 * Extract deal value from call or CRM data
 */
function extractDealValue(call?: Call & { company: Company }, opportunity?: any): number | undefined {
  // Try CRM opportunity value first
  if (opportunity?.amount && typeof opportunity.amount === 'number') {
    return opportunity.amount;
  }

  // Try to parse from opportunity name or description
  if (opportunity?.name) {
    const match = opportunity.name.match(/\$([0-9,]+)k?/i);
    if (match) {
      const amount = parseInt(match[1].replace(',', ''));
      return match[0].includes('k') ? amount * 1000 : amount;
    }
  }

  // Default estimates based on company size
  const companySize = call?.company?.industry;
  if (companySize?.includes('enterprise')) return 250000;
  if (companySize?.includes('mid-market')) return 100000;
  if (companySize?.includes('smb')) return 25000;

  return undefined;
}

/**
 * Determine company size from available data
 */
function determineCompanySize(company?: Company, account?: any): string {
  // Check for explicit size indicators
  if (account?.employees || company?.industry) {
    const employees = account?.employees;
    const industry = company?.industry?.toLowerCase() || '';
    
    if (employees) {
      if (employees > 5000) return 'enterprise';
      if (employees > 500) return 'mid-market';
      if (employees > 50) return 'smb';
      return 'startup';
    }

    // Industry-based heuristics
    if (industry.includes('enterprise') || industry.includes('fortune')) return 'enterprise';
    if (industry.includes('startup') || industry.includes('early-stage')) return 'startup';
  }

  return 'mid-market'; // Default assumption
}

/**
 * Assess sales cycle length
 */
function assessSalesCycle(
  dealValue?: number, 
  industry?: string, 
  companySize?: string
): CallContext['salesCycle'] {
  // High-value deals typically have longer cycles
  if (dealValue && dealValue > 500000) return 'long';
  if (dealValue && dealValue < 50000) return 'short';

  // Enterprise deals typically have longer cycles
  if (companySize === 'enterprise') return 'long';
  if (companySize === 'startup') return 'short';

  // Industry-specific patterns
  const industryLower = industry?.toLowerCase() || '';
  if (industryLower.includes('healthcare') || industryLower.includes('finance') || 
      industryLower.includes('government')) {
    return 'long';
  }
  if (industryLower.includes('saas') || industryLower.includes('technology')) {
    return 'medium';
  }

  return 'medium'; // Default
}

/**
 * Assess deal complexity
 */
function assessComplexity(
  dealValue?: number,
  industry?: string, 
  companySize?: string,
  contactCount?: number
): CallContext['complexity'] {
  let complexityScore = 0;

  // Deal value impact
  if (dealValue && dealValue > 500000) complexityScore += 2;
  else if (dealValue && dealValue > 100000) complexityScore += 1;

  // Company size impact  
  if (companySize === 'enterprise') complexityScore += 2;
  else if (companySize === 'mid-market') complexityScore += 1;

  // Industry impact
  const industryLower = industry?.toLowerCase() || '';
  if (industryLower.includes('healthcare') || industryLower.includes('finance') ||
      industryLower.includes('government') || industryLower.includes('manufacturing')) {
    complexityScore += 1;
  }

  // Stakeholder count impact
  if (contactCount && contactCount > 5) complexityScore += 2;
  else if (contactCount && contactCount > 2) complexityScore += 1;

  // Convert score to complexity level
  if (complexityScore >= 4) return 'high';
  if (complexityScore >= 2) return 'medium';
  return 'low';
}

/**
 * Assess if this is new business vs existing customer
 */
function assessIsNewBusiness(
  call?: Call & { company: Company },
  crmData?: any,
  additionalContext?: any
): boolean {
  // Check for existing relationship indicators
  if (additionalContext?.previousInteractions?.length > 0) return false;
  if (crmData?.opportunity?.type?.toLowerCase().includes('expansion')) return false;
  if (crmData?.opportunity?.type?.toLowerCase().includes('renewal')) return false;
  
  // Default to new business if no strong signals of existing relationship
  return true;
}

/**
 * Generate context summary for prompts
 */
export function generateContextSummary(context: CallContext): string {
  const summary = `
**Call Context Analysis:**
- **Call Type:** ${context.callType} (${getCallTypeDescription(context.callType)})
- **Deal Stage:** ${context.dealStage}
- **Deal Value:** ${context.dealValue ? `$${context.dealValue.toLocaleString()}` : 'Unknown'}
- **Industry:** ${context.industry || 'Not specified'}
- **Company Size:** ${context.companySize}
- **Sales Cycle:** ${context.salesCycle} (${getSalesCycleDescription(context.salesCycle)})
- **Complexity:** ${context.complexity}
- **Customer Type:** ${context.isNewBusiness ? 'New Business' : 'Existing Customer'}

**Methodology Recommendation:** Based on this context, the system will prioritize methodologies that are most effective for ${context.callType} calls in ${context.dealStage} stage ${context.complexity}-complexity deals.
  `.trim();

  return summary;
}

function getCallTypeDescription(callType: string): string {
  const descriptions = {
    'discovery': 'Initial needs assessment and qualification',
    'demo': 'Solution presentation and capability demonstration', 
    'proposal': 'Pricing discussion and proposal presentation',
    'negotiation': 'Contract terms and final agreement',
    'closing': 'Final decision and signature',
    'followup': 'Relationship maintenance and expansion'
  };
  return descriptions[callType as keyof typeof descriptions] || 'General sales conversation';
}

function getSalesCycleDescription(salesCycle: string): string {
  const descriptions = {
    'short': '1-3 months typical decision timeframe',
    'medium': '3-6 months typical decision timeframe',
    'long': '6+ months typical decision timeframe'
  };
  return descriptions[salesCycle as keyof typeof descriptions] || 'Variable timeframe';
}