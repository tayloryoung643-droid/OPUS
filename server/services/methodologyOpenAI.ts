/**
 * Enhanced OpenAI Service with Multi-Methodology Sales Framework
 * Integrates MEDDIC, BANT, SPIN, Challenger, Sandler, and Solution Selling methodologies
 */

import OpenAI from "openai";
import type { Call, Company, Contact } from '@shared/schema';
import { analyzeCallContext, type AnalysisInputs } from './callContextAnalyzer';
import { 
  calculateMethodologyWeights, 
  generateMethodologySummary,
  type CallContext 
} from './salesMethodologies';
import { 
  generateCallPrepPrompt,
  generateLiveCoachingPrompt,
  generateObjectionHandlingPrompt,
  type ProspectResearchInput,
  type MethodologyPromptContext
} from './methodologyPrompts';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export interface EnhancedProspectResearchInput {
  call: Call & { company: Company };
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

export interface MethodologyAwareOutput {
  executiveSummary: string;
  customerProfile: {
    industryBackground: string;
    currentChallenges: string[];
    stakeholders: string[];
  };
  spinQuestions: {
    situation: string[];
    problem: string[];
    implication: string[];
    needPayoff: string[];
  };
  meddicChecklist: {
    metrics: string;
    economicBuyer: string;
    decisionCriteria: string;
    decisionProcess: string;
    identifiedPain: string;
    champion: string;
    competition: string;
  };
  bantAssessment: {
    budget: string;
    authority: string;
    need: string;
    timeline: string;
  };
  challengerInsights: string[];
  solutionAlignment: string;
  objectionHandling: Array<{
    objection: string;
    response: string;
    methodology: string;
  }>;
  callAgenda: string[];
  nextSteps: string[];
  methodologySummary: string;
  contextAnalysis: string;
}

/**
 * Generate methodology-aware call preparation using enhanced prompts
 */
export async function generateMethodologyAwareCallPrep(
  input: EnhancedProspectResearchInput,
  mcpServer?: any
): Promise<MethodologyAwareOutput> {
  try {
    console.log('[Methodology-OpenAI] Starting enhanced call prep generation');

    // Analyze call context to determine methodology approach
    const callContext = await analyzeCallContext({
      call: input.call,
      calendarEvent: input.calendarEvent,
      crmData: input.crmData,
      additionalContext: input.additionalContext
    });

    // Calculate methodology weights based on context
    const methodologyWeights = calculateMethodologyWeights(callContext);
    
    console.log('[Methodology-OpenAI] Context analysis completed:', {
      callType: callContext.callType,
      dealStage: callContext.dealStage,
      complexity: callContext.complexity,
      topMethodologies: Object.entries(methodologyWeights)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 2)
        .map(([name, weight]) => `${name}: ${Math.round(weight * 100)}%`)
    });

    // Prepare prospect data for prompt
    const prospectData: ProspectResearchInput = {
      companyName: input.call.company.name,
      contactName: input.crmData?.contacts?.[0]?.name,
      industry: input.call.company.industry || input.crmData?.account?.industry,
      meetingTitle: input.call.title,
      meetingDate: input.call.scheduledAt?.toString(),
      attendees: input.crmData?.contacts?.map(c => `${c.name} (${c.title})`),
      crmNotes: input.additionalContext?.previousInteractions?.join(' | '),
      previousInteractions: input.additionalContext?.previousInteractions,
      knownPainPoints: input.additionalContext?.knownPainPoints,
      competitorIntel: input.additionalContext?.competitorIntel
    };

    // Build methodology prompt context
    const promptContext: MethodologyPromptContext = {
      callContext,
      methodologyWeights,
      prospectData,
      additionalContext: {
        dealValue: input.crmData?.opportunity?.amount,
        salesStage: input.call.stage,
        competitivePosition: input.crmData?.opportunity?.competitionStatus
      }
    };

    // Generate methodology-aware prompt
    const prompt = generateCallPrepPrompt(promptContext);

    // Get available MCP tools
    const availableTools = mcpServer ? mcpServer.getOpenAIFunctions() : [];
    const hasTools = availableTools.length > 0;

    console.log(`[Methodology-OpenAI] Making request with ${availableTools.length} available tools`);

    // Make OpenAI request with tools if available
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert AI Sales Coach that specializes in multi-methodology sales preparation. You combine MEDDIC, BANT, SPIN Selling, Challenger Sale, Sandler, and Solution Selling methodologies strategically based on call context.

${hasTools ? 'You have access to live data tools. Use them to gather current information before generating your structured response.' : 'Generate responses based on the provided context.'}

Always respond with a comprehensive, well-structured call prep sheet in markdown format that follows the methodology priorities specified in the prompt.`
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      tools: hasTools ? availableTools : undefined,
      tool_choice: hasTools ? "auto" : undefined,
      temperature: 0.7,
      max_tokens: 4000
    });

    const rawContent = response.choices[0]?.message?.content || '';
    console.log('[Methodology-OpenAI] Raw response length:', rawContent.length);

    // Parse the structured response into our output format
    const structuredOutput = parseMethodologyResponse(
      rawContent, 
      callContext, 
      methodologyWeights
    );

    console.log('[Methodology-OpenAI] Enhanced call prep generation completed');
    return structuredOutput;

  } catch (error) {
    console.error('[Methodology-OpenAI] Error generating enhanced call prep:', error);
    throw new Error('Failed to generate methodology-aware call preparation');
  }
}

/**
 * Generate live coaching suggestions during active calls
 */
export async function generateLiveCoachingSuggestion(
  callContext: CallContext,
  methodologyWeights: MethodologyWeights,
  currentTranscript: string,
  scenario: string
): Promise<string> {
  try {
    const promptContext: MethodologyPromptContext = {
      callContext,
      methodologyWeights,
      prospectData: {} as ProspectResearchInput // Not needed for live coaching
    };

    const prompt = generateLiveCoachingPrompt(promptContext, currentTranscript, scenario);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a live sales coach providing real-time guidance during active sales calls. Be concise, tactical, and immediately actionable."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.6,
      max_tokens: 500
    });

    return response.choices[0]?.message?.content || 'Unable to generate coaching suggestion';

  } catch (error) {
    console.error('[Methodology-OpenAI] Error generating live coaching:', error);
    throw new Error('Failed to generate live coaching suggestion');
  }
}

/**
 * Parse methodology-aware response into structured format
 */
function parseMethodologyResponse(
  rawResponse: string,
  callContext: CallContext,
  methodologyWeights: MethodologyWeights
): MethodologyAwareOutput {
  // Extract sections using markdown patterns
  const sections = extractMarkdownSections(rawResponse);
  
  return {
    executiveSummary: sections['opportunity overview'] || sections['executive summary'] || 'Summary not available',
    
    customerProfile: {
      industryBackground: extractSubsection(sections['customer profile'], 'industry & background') || 'Not specified',
      currentChallenges: extractListItems(sections['customer profile'], 'current challenges') || [],
      stakeholders: extractListItems(sections['customer profile'], 'stakeholders') || []
    },
    
    spinQuestions: {
      situation: extractListItems(sections['spin discovery questions'], 'situation') || [],
      problem: extractListItems(sections['spin discovery questions'], 'problem') || [],
      implication: extractListItems(sections['spin discovery questions'], 'implication') || [],
      needPayoff: extractListItems(sections['spin discovery questions'], 'need-payoff') || []
    },
    
    meddicChecklist: {
      metrics: extractSubsection(sections['meddic qualification checklist'], 'metrics') || 'To be determined',
      economicBuyer: extractSubsection(sections['meddic qualification checklist'], 'economic buyer') || 'To be identified',
      decisionCriteria: extractSubsection(sections['meddic qualification checklist'], 'decision criteria') || 'To be discovered',
      decisionProcess: extractSubsection(sections['meddic qualification checklist'], 'decision process') || 'To be mapped',
      identifiedPain: extractSubsection(sections['meddic qualification checklist'], 'identified pain') || 'To be uncovered',
      champion: extractSubsection(sections['meddic qualification checklist'], 'champion') || 'To be developed',
      competition: extractSubsection(sections['meddic qualification checklist'], 'competition') || 'To be assessed'
    },
    
    bantAssessment: {
      budget: extractSubsection(sections['bant quick assessment'], 'budget') || 'To be qualified',
      authority: extractSubsection(sections['bant quick assessment'], 'authority') || 'To be identified',
      need: extractSubsection(sections['bant quick assessment'], 'need') || 'To be validated',
      timeline: extractSubsection(sections['bant quick assessment'], 'timeline') || 'To be determined'
    },
    
    challengerInsights: extractListItems(sections['challenger insights'], '') || [],
    solutionAlignment: sections['solution alignment'] || 'To be developed based on discovered needs',
    
    objectionHandling: parseObjectionHandling(sections['objection handling & sandler tactics'] || ''),
    
    callAgenda: extractListItems(sections['call agenda & next steps'], 'agenda') || 
                extractListItems(sections['call agenda & next steps'], '') || [],
    
    nextSteps: extractListItems(sections['call agenda & next steps'], 'next steps') || [],
    
    methodologySummary: generateMethodologySummary(methodologyWeights),
    contextAnalysis: `${callContext.callType} | ${callContext.dealStage} | ${callContext.complexity} complexity`
  };
}

// Helper functions for parsing markdown sections
function extractMarkdownSections(markdown: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = markdown.split('\n');
  let currentSection = '';
  let currentContent = '';

  for (const line of lines) {
    if (line.startsWith('## ') || line.startsWith('# ')) {
      if (currentSection) {
        sections[currentSection.toLowerCase()] = currentContent.trim();
      }
      currentSection = line.replace(/^#+\s+/, '').replace(/^\d+\.\s+/, '');
      currentContent = '';
    } else {
      currentContent += line + '\n';
    }
  }

  if (currentSection) {
    sections[currentSection.toLowerCase()] = currentContent.trim();
  }

  return sections;
}

function extractSubsection(content: string, subsection: string): string {
  if (!content) return '';
  
  const regex = new RegExp(`\\*\\*${subsection}:?\\*\\*\\s*([^\\*\\n]+)`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

function extractListItems(content: string, subsection?: string): string[] {
  if (!content) return [];
  
  let searchContent = content;
  if (subsection) {
    const subsectionRegex = new RegExp(`\\*\\*${subsection}:?\\*\\*([^\\*]*)`, 'i');
    const match = content.match(subsectionRegex);
    searchContent = match ? match[1] : content;
  }
  
  const items = searchContent.match(/^[\s-*]\s*(.+)$/gm) || [];
  return items.map(item => item.replace(/^[\s-*]\s*/, '').trim()).filter(item => item.length > 0);
}

function parseObjectionHandling(content: string): Array<{objection: string, response: string, methodology: string}> {
  const objections: Array<{objection: string, response: string, methodology: string}> = [];
  
  // Look for objection patterns like "Objection: ... Response: ..."
  const objectionMatches = content.match(/(?:\*\*)?(?:objection|concern):?\*?\*?\s*["']?([^"'\n]+)["']?\s*(?:\*\*)?(?:response|coach tip):?\*?\*?\s*([^*\n]+)/gi);
  
  if (objectionMatches) {
    objectionMatches.forEach(match => {
      const parts = match.split(/(?:\*\*)?(?:response|coach tip):?\*?\*?\s*/i);
      if (parts.length >= 2) {
        const objection = parts[0].replace(/(?:\*\*)?(?:objection|concern):?\*?\*?\s*/i, '').trim();
        const response = parts[1].trim();
        objections.push({
          objection,
          response,
          methodology: 'Mixed' // Could be enhanced to detect specific methodology
        });
      }
    });
  }
  
  return objections;
}

export { generateCallPrepPrompt, generateLiveCoachingPrompt, generateObjectionHandlingPrompt };