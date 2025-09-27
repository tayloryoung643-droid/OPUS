/**
 * Methodology-Aware Prompt Generation Service
 * Creates prompts that dynamically incorporate multiple sales methodologies
 * based on call context and methodology weights
 */

import { 
  SALES_METHODOLOGIES, 
  calculateMethodologyWeights, 
  generateMethodologyInstructions,
  getStructuredOutputFormat,
  type CallContext,
  type MethodologyWeights
} from './salesMethodologies';
import { generateContextSummary } from './callContextAnalyzer';

export interface ProspectResearchInput {
  companyName: string;
  contactName?: string;
  industry?: string;
  meetingTitle?: string;
  meetingDate?: string;
  attendees?: string[];
  crmNotes?: string;
  previousInteractions?: string[];
  knownPainPoints?: string[];
  competitorIntel?: string[];
}

export interface MethodologyPromptContext {
  callContext: CallContext;
  methodologyWeights: MethodologyWeights;
  prospectData: ProspectResearchInput;
  additionalContext?: {
    dealValue?: number;
    salesStage?: string;
    competitivePosition?: string;
  };
}

/**
 * Generate methodology-aware call preparation prompt
 */
export function generateCallPrepPrompt(context: MethodologyPromptContext): string {
  const { callContext, methodologyWeights, prospectData, additionalContext } = context;

  const contextSummary = generateContextSummary(callContext);
  const methodologyInstructions = generateMethodologyInstructions(callContext, methodologyWeights);
  const outputFormat = getStructuredOutputFormat(methodologyWeights);
  const specificGuidance = generateSpecificMethodologyGuidance(methodologyWeights);

  const prompt = `
You are an expert AI Sales Assistant helping a sales representative prepare for an upcoming call. Your expertise spans multiple proven sales methodologies, and you excel at combining them strategically based on the specific context of each sales situation.

${contextSummary}

**Meeting Details:**
- **Company:** ${prospectData.companyName}
- **Contact:** ${prospectData.contactName || 'Multiple attendees'}
- **Industry:** ${prospectData.industry || 'Not specified'}
- **Meeting Title:** ${prospectData.meetingTitle || 'Sales Call'}
- **Meeting Date:** ${prospectData.meetingDate || 'Not specified'}
- **Attendees:** ${prospectData.attendees?.join(', ') || 'Not specified'}

**Available Context:**
${buildContextSection(prospectData, additionalContext)}

${methodologyInstructions}

${specificGuidance}

**Your Mission:**
Generate a comprehensive, methodology-driven call preparation sheet that gives the sales rep everything they need to conduct a highly effective call. The prep should be tailored specifically to this ${callContext.callType} call for this ${callContext.complexity}-complexity ${callContext.dealStage} stage opportunity.

**Critical Requirements:**
1. **Be Specific:** Reference actual company, industry, and known context - no generic advice
2. **Prioritize Methodologies:** Weight your guidance according to the methodology priorities above
3. **Action-Oriented:** Provide concrete questions, talking points, and tactics
4. **Structured:** Use clear sections and formatting for easy scanning during the call
5. **Comprehensive:** Cover preparation, execution, and follow-up strategies

${outputFormat}

**Quality Standards:**
- Every question should be tailored to this specific prospect and situation
- Include at least 3-5 concrete questions for each major methodology section
- Provide specific objection responses based on likely concerns for this industry/company size
- Give tactical guidance (exact phrases, transitions, techniques) not just general advice
- Include clear next-step recommendations with specific timelines

Begin generating the comprehensive call preparation sheet now in markdown format:
`.trim();

  return prompt;
}

/**
 * Generate methodology-specific guidance based on weights
 */
function generateSpecificMethodologyGuidance(weights: MethodologyWeights): string {
  const topMethodologies = Object.entries(weights)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([name]) => name);

  let guidance = "**Methodology-Specific Guidance:**\n\n";

  topMethodologies.forEach((methodName, index) => {
    const methodology = SALES_METHODOLOGIES[methodName];
    const weight = weights[methodName as keyof MethodologyWeights];
    const emphasis = weight > 0.3 ? 'HEAVY' : weight > 0.2 ? 'MODERATE' : 'LIGHT';

    guidance += `**${methodology.name} (${emphasis} emphasis - ${Math.round(weight * 100)}%):**\n`;
    guidance += `${methodology.description}\n\n`;

    // Add specific tactical guidance for top methodology
    if (index === 0) {
      guidance += "Key Tactics for This Call:\n";
      methodology.tactics.slice(0, 3).forEach(tactic => {
        guidance += `- ${tactic}\n`;
      });
      guidance += "\n";

      guidance += "Priority Questions:\n";
      methodology.questions.slice(0, 3).forEach((question, qIndex) => {
        guidance += `${qIndex + 1}. ${question}\n`;
      });
      guidance += "\n";
    }
  });

  return guidance;
}

/**
 * Build context section from available data
 */
function buildContextSection(
  prospectData: ProspectResearchInput, 
  additionalContext?: any
): string {
  let context = "";

  if (prospectData.crmNotes) {
    context += `**CRM Notes:** ${prospectData.crmNotes}\n`;
  }

  if (prospectData.previousInteractions?.length) {
    context += `**Previous Interactions:**\n`;
    prospectData.previousInteractions.forEach(interaction => {
      context += `- ${interaction}\n`;
    });
  }

  if (prospectData.knownPainPoints?.length) {
    context += `**Known Pain Points:**\n`;
    prospectData.knownPainPoints.forEach(pain => {
      context += `- ${pain}\n`;
    });
  }

  if (prospectData.competitorIntel?.length) {
    context += `**Competitive Intelligence:**\n`;
    prospectData.competitorIntel.forEach(intel => {
      context += `- ${intel}\n`;
    });
  }

  if (additionalContext?.dealValue) {
    context += `**Deal Value:** $${additionalContext.dealValue.toLocaleString()}\n`;
  }

  if (additionalContext?.salesStage) {
    context += `**Sales Stage:** ${additionalContext.salesStage}\n`;
  }

  if (additionalContext?.competitivePosition) {
    context += `**Competitive Position:** ${additionalContext.competitivePosition}\n`;
  }

  return context || "*No additional context available - focus on discovery*";
}

/**
 * Generate live coaching prompt for real-time suggestions
 */
export function generateLiveCoachingPrompt(
  context: MethodologyPromptContext,
  currentTranscript: string,
  specificScenario: string
): string {
  const { callContext, methodologyWeights } = context;

  const topMethodologies = Object.entries(methodologyWeights)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 2)
    .map(([name]) => name);

  const prompt = `
You are providing live sales coaching during an active ${callContext.callType} call. Based on the current conversation, provide immediate, actionable coaching suggestions.

**Call Context:** ${callContext.callType} for ${callContext.dealStage} stage ${callContext.complexity} complexity deal

**Primary Methodologies:** ${topMethodologies.map(m => SALES_METHODOLOGIES[m].name).join(' + ')}

**Current Conversation:**
${currentTranscript}

**Immediate Situation:**
${specificScenario}

**Provide coaching in this format:**

**🎯 Immediate Suggestion:**
[One specific action the rep should take right now]

**💬 Exact Response:**
[Exact words/phrases the rep can use, formatted as: "You could say: '...'"]

**🤔 Follow-up Questions:**
[1-2 strategic questions to ask next based on primary methodologies]

**⚠️ Watch Out For:**
[One potential pitfall or objection to be ready for]

Keep responses concise, tactical, and immediately actionable. Focus on the ${topMethodologies[0]} approach primarily.
`.trim();

  return prompt;
}

/**
 * Generate objection handling prompt with methodology-specific responses
 */
export function generateObjectionHandlingPrompt(
  context: MethodologyPromptContext,
  objection: string
): string {
  const { methodologyWeights } = context;

  // Find the methodology most suited for objection handling
  const objectionMethodologies = ['sandler', 'challenger', 'spin'];
  const bestMethod = objectionMethodologies.reduce((best, method) => {
    return methodologyWeights[method as keyof MethodologyWeights] > 
           methodologyWeights[best as keyof MethodologyWeights] ? method : best;
  }, objectionMethodologies[0]);

  const methodology = SALES_METHODOLOGIES[bestMethod];

  const prompt = `
Handle this objection using ${methodology.name} methodology:

**Objection:** "${objection}"

**${methodology.name} Approach:**
${methodology.description}

Provide a response that:
1. Acknowledges the concern
2. Uses ${methodology.name} tactics: ${methodology.tactics[0]}
3. Includes a strategic follow-up question
4. Maintains control of the conversation

**Format your response as:**
**Acknowledge:** [How to acknowledge their concern]
**Reframe:** [${methodology.name}-specific reframe or question]
**Advance:** [How to move the conversation forward]
`.trim();

  return prompt;
}

/**
 * Generate methodology summary for UI display
 */
export function generateMethodologySummary(weights: MethodologyWeights): string {
  const sorted = Object.entries(weights)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3);

  let summary = "**Methodology Mix:** ";
  summary += sorted.map(([name, weight]) => 
    `${SALES_METHODOLOGIES[name].name} (${Math.round(weight * 100)}%)`
  ).join(" + ");

  return summary;
}