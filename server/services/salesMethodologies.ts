/**
 * Sales Methodology Framework Service
 * Implements multi-methodology approach combining MEDDIC, BANT, SPIN, Challenger Sale, Sandler, and Solution Selling
 */

export interface CallContext {
  callType: 'discovery' | 'demo' | 'proposal' | 'negotiation' | 'closing' | 'followup';
  dealStage: 'prospecting' | 'qualifying' | 'developing' | 'proposing' | 'negotiating' | 'closed';
  dealValue?: number;
  industry?: string;
  companySize?: string;
  salesCycle?: 'short' | 'medium' | 'long';
  complexity?: 'low' | 'medium' | 'high';
  isNewBusiness?: boolean;
}

export interface MethodologyWeights {
  meddic: number;
  bant: number;
  spin: number;
  challenger: number;
  sandler: number;
  solutionSelling: number;
}

export interface MethodologyFramework {
  name: string;
  description: string;
  primaryUseCase: string;
  components: string[];
  questions: string[];
  tactics: string[];
}

// Define each sales methodology framework
export const SALES_METHODOLOGIES: Record<string, MethodologyFramework> = {
  meddic: {
    name: "MEDDIC",
    description: "Enterprise sales qualification framework for complex B2B deals",
    primaryUseCase: "High-value enterprise deals with multiple stakeholders",
    components: [
      "Metrics - What economic impact will our solution have?",
      "Economic Buyer - Who has budget authority and final approval?", 
      "Decision Criteria - What factors will influence their decision?",
      "Decision Process - What steps must be followed to get approval?",
      "Identified Pain - What business pain are we solving?",
      "Champion - Who will advocate for our solution internally?"
    ],
    questions: [
      "What metrics would you use to measure success with this solution?",
      "Who ultimately approves expenditures of this size in your organization?",
      "What criteria are most important in evaluating potential solutions?",
      "What's your typical approval process for investments like this?",
      "What's driving the urgency to solve this problem now?",
      "Who else would benefit from seeing this problem solved?"
    ],
    tactics: [
      "Always identify and engage the Economic Buyer",
      "Quantify pain with specific metrics and business impact",
      "Map the complete decision-making process",
      "Develop multiple champions across different departments"
    ]
  },
  
  bant: {
    name: "BANT", 
    description: "Quick qualification framework for lead assessment",
    primaryUseCase: "Initial lead qualification and pipeline management",
    components: [
      "Budget - Do they have allocated funds?",
      "Authority - Can they make or influence the decision?",
      "Need - Do they have a compelling business need?", 
      "Timeline - When do they need to implement?"
    ],
    questions: [
      "What budget have you allocated for addressing this challenge?",
      "Who would be involved in evaluating and selecting a solution?",
      "What happens if you don't solve this problem this year?",
      "What's driving the timeline for making a decision?"
    ],
    tactics: [
      "Use BANT for initial lead scoring and prioritization",
      "Qualify out leads that don't meet minimum BANT criteria",
      "Layer additional methodologies on top of BANT-qualified leads"
    ]
  },

  spin: {
    name: "SPIN Selling",
    description: "Consultative selling through strategic questioning",
    primaryUseCase: "Discovery calls and needs development conversations",
    components: [
      "Situation Questions - Understand current state",
      "Problem Questions - Identify challenges and pain points",
      "Implication Questions - Explore consequences of problems",
      "Need-Payoff Questions - Build value for solutions"
    ],
    questions: [
      "Situation: How are you currently handling [relevant process]?",
      "Problem: What challenges are you experiencing with your current approach?",
      "Implication: What impact do these challenges have on your team's productivity?",
      "Need-Payoff: How would solving this problem benefit your organization?"
    ],
    tactics: [
      "Start with situation questions to understand context",
      "Use problem questions to uncover pain points",
      "Develop implications to create urgency",
      "Build value with need-payoff questions before presenting solutions"
    ]
  },

  challenger: {
    name: "Challenger Sale",
    description: "Challenge customer thinking with provocative insights",
    primaryUseCase: "Differentiating in competitive deals and creating urgency",
    components: [
      "Teach - Share insights that challenge conventional thinking",
      "Tailor - Customize message to individual stakeholder concerns", 
      "Take Control - Lead the sales conversation confidently"
    ],
    questions: [
      "What would happen to your competitive position if you continued with the status quo?",
      "Have you considered how [industry trend] might impact your current strategy?",
      "What would it mean for your business if competitors solved this problem first?"
    ],
    tactics: [
      "Lead with insight, not product features",
      "Challenge assumptions about their current approach",
      "Create constructive tension to drive action",
      "Position yourself as a trusted advisor, not just a vendor"
    ]
  },

  sandler: {
    name: "Sandler",
    description: "Pain-focused selling methodology with psychological tactics",
    primaryUseCase: "Building rapport and uncovering emotional drivers",
    components: [
      "Upfront Contract - Set clear expectations for each interaction",
      "Pain Funnel - Dig deep into emotional and business pain",
      "Budget Discussion - Address money concerns directly",
      "Decision Process - Understand how decisions really get made"
    ],
    questions: [
      "What's the cost of not fixing this problem?",
      "How long have you been struggling with this issue?",
      "What have you tried before that didn't work?",
      "What would have to happen for this to become a priority?"
    ],
    tactics: [
      "Use an upfront contract to set meeting expectations",
      "Ask permission before diving into sensitive topics",
      "Focus on pain before presenting solutions",
      "Use reversal techniques to maintain control"
    ]
  },

  solutionSelling: {
    name: "Solution Selling",
    description: "Align solutions to specific business problems and outcomes",
    primaryUseCase: "Complex solution sales requiring customization",
    components: [
      "Problem Identification - Clearly define business problems",
      "Solution Mapping - Connect capabilities to problems",
      "Value Proposition - Articulate specific business value",
      "Implementation Planning - Address how success will be achieved"
    ],
    questions: [
      "What specific business outcomes are you trying to achieve?",
      "What would success look like 12 months from now?",
      "What obstacles have prevented you from achieving this in the past?",
      "How would you measure ROI on this investment?"
    ],
    tactics: [
      "Focus on business outcomes rather than product features",
      "Build solutions collaboratively with the prospect",
      "Quantify value in terms meaningful to the customer",
      "Create detailed implementation roadmaps"
    ]
  }
};

/**
 * Analyze call context and determine methodology weights
 */
export function calculateMethodologyWeights(context: CallContext): MethodologyWeights {
  let weights: MethodologyWeights = {
    meddic: 0.2,
    bant: 0.2, 
    spin: 0.2,
    challenger: 0.1,
    sandler: 0.15,
    solutionSelling: 0.15
  };

  // Adjust weights based on call type
  switch (context.callType) {
    case 'discovery':
      weights.spin = 0.4;  // Heavy emphasis on discovery questions
      weights.bant = 0.25; // Important for initial qualification
      weights.sandler = 0.2; // Good for uncovering pain
      weights.meddic = 0.1;
      weights.challenger = 0.05;
      break;
      
    case 'demo':
      weights.solutionSelling = 0.35; // Focus on solution alignment
      weights.spin = 0.25; // Continue needs development
      weights.challenger = 0.2; // Differentiate from competition
      weights.meddic = 0.15;
      weights.sandler = 0.05;
      break;
      
    case 'proposal':
    case 'negotiation':
      weights.meddic = 0.4; // Critical for enterprise deals
      weights.challenger = 0.25; // Create urgency and differentiation
      weights.sandler = 0.2; // Handle objections and maintain control
      weights.solutionSelling = 0.1;
      weights.spin = 0.05;
      break;
  }

  // Adjust based on deal characteristics
  if (context.dealValue && context.dealValue > 100000) {
    // High-value deals need more MEDDIC
    weights.meddic += 0.1;
    weights.bant -= 0.05;
    weights.spin -= 0.05;
  }

  if (context.complexity === 'high') {
    // Complex deals need more structured approach
    weights.meddic += 0.1;
    weights.solutionSelling += 0.1;
    weights.bant -= 0.1;
    weights.sandler -= 0.1;
  }

  if (context.isNewBusiness) {
    // New business needs more discovery and challenge
    weights.spin += 0.1;
    weights.challenger += 0.1;
    weights.meddic -= 0.1;
    weights.solutionSelling -= 0.1;
  }

  // Normalize weights to sum to 1.0
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  Object.keys(weights).forEach(key => {
    weights[key as keyof MethodologyWeights] = weights[key as keyof MethodologyWeights] / total;
  });

  return weights;
}

/**
 * Generate methodology-aware prompt instructions
 */
export function generateMethodologyInstructions(
  context: CallContext, 
  weights: MethodologyWeights
): string {
  const sortedMethodologies = Object.entries(weights)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3) // Top 3 methodologies
    .map(([name]) => name);

  let instructions = `**Sales Methodology Approach:**\n\n`;
  instructions += `Based on this ${context.callType} call for a ${context.dealStage} stage opportunity, prioritize these methodologies:\n\n`;

  sortedMethodologies.forEach((methodName, index) => {
    const methodology = SALES_METHODOLOGIES[methodName];
    const weight = weights[methodName as keyof MethodologyWeights];
    const priority = index === 0 ? 'PRIMARY' : index === 1 ? 'SECONDARY' : 'SUPPORTING';
    
    instructions += `**${priority}: ${methodology.name} (${Math.round(weight * 100)}% emphasis)**\n`;
    instructions += `${methodology.description}\n`;
    instructions += `Key Components: ${methodology.components.slice(0, 3).join(', ')}\n\n`;
  });

  return instructions;
}

/**
 * Get structured output format based on methodology weights
 */
export function getStructuredOutputFormat(weights: MethodologyWeights): string {
  const format = `
**Structure your response with these sections:**

## 1. Opportunity Overview
Brief summary of the prospect, their situation, and business context.

## 2. Customer Profile  
- **Industry & Background:** Key details about the company
- **Current Challenges:** Known pain points and problems
- **Stakeholders:** Key people involved in the decision

## 3. SPIN Discovery Questions
${weights.spin > 0.2 ? '(Priority section for this call type)' : ''}
- **Situation:** Questions to understand current state
- **Problem:** Questions to identify challenges
- **Implication:** Questions to explore consequences  
- **Need-Payoff:** Questions to build value for solutions

## 4. MEDDIC Qualification Checklist
${weights.meddic > 0.3 ? '(Critical for this opportunity size/complexity)' : ''}
- **Metrics:** Success measurements and KPIs
- **Economic Buyer:** Budget authority and final approver
- **Decision Criteria:** Evaluation factors
- **Decision Process:** Approval workflow and timeline
- **Identified Pain:** Specific business problems
- **Champion:** Internal advocates

## 5. BANT Quick Assessment
${weights.bant > 0.3 ? '(Essential qualification criteria)' : ''}
- **Budget:** Available funding and financial authority
- **Authority:** Decision makers and influencers
- **Need:** Compelling business reasons to change
- **Timeline:** Implementation urgency and deadlines

## 6. Challenger Insights
${weights.challenger > 0.2 ? '(Key differentiator for competitive deals)' : ''}
Provocative insights that challenge their current thinking or highlight hidden problems.

## 7. Solution Alignment
${weights.solutionSelling > 0.2 ? '(Focus on outcome-based value)' : ''}
How our capabilities map to their specific problems and desired outcomes.

## 8. Objection Handling & Sandler Tactics
${weights.sandler > 0.2 ? '(Pain-focused approach)' : ''}
- Likely objections and responses
- Pain funnel questions for deeper discovery
- Upfront contract language for call management

## 9. Call Agenda & Next Steps
Structured agenda with methodology-specific talking points and follow-up actions.
`;

  return format;
}