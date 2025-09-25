import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

interface ProspectResearchInput {
  companyName: string;
  companyDomain?: string;
  industry?: string;
  contactEmails: string[];
}

interface ProspectResearchOutput {
  executiveSummary: string;
  crmHistory: string;
  competitiveLandscape: {
    primaryCompetitors: Array<{
      name: string;
      strengths: string[];
      weaknesses: string[];
      ourAdvantage: string;
    }>;
  };
  conversationStrategy: string;
  dealRisks: string[];
  immediateOpportunities: string[];
  strategicExpansion: string[];
  recentNews: string[];
}

export async function generateProspectResearch(input: ProspectResearchInput): Promise<ProspectResearchOutput> {
  try {
    const prompt = `You are an AI sales assistant helping prepare for a sales call. Generate comprehensive prospect research for the following company:

Company: ${input.companyName}
Domain: ${input.companyDomain || 'N/A'}
Industry: ${input.industry || 'N/A'}
Key Contacts: ${input.contactEmails.join(', ')}

Provide detailed research in the following JSON format:
{
  "executiveSummary": "Brief summary of the meeting context and key focus areas",
  "crmHistory": "Summary of past interactions and current relationship status",
  "competitiveLandscape": {
    "primaryCompetitors": [
      {
        "name": "Competitor name",
        "strengths": ["strength 1", "strength 2"],
        "weaknesses": ["weakness 1", "weakness 2"],
        "ourAdvantage": "How we differentiate"
      }
    ]
  },
  "conversationStrategy": "Recommended talking points and questions to ask",
  "dealRisks": ["potential risk 1", "potential risk 2"],
  "immediateOpportunities": ["opportunity 1", "opportunity 2"],
  "strategicExpansion": ["expansion idea 1", "expansion idea 2"],
  "recentNews": ["news item 1", "news item 2"]
}

Focus on actionable insights that will help close deals and build relationships.`;

    // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are an expert sales enablement AI that generates comprehensive prospect research and call preparation materials. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return result as ProspectResearchOutput;
  } catch (error) {
    console.error('Failed to generate prospect research:', error);
    throw new Error('Failed to generate AI-powered prospect research: ' + (error as Error).message);
  }
}

export async function enhanceCompanyData(companyName: string, domain?: string): Promise<{
  industry: string;
  size: string;
  description: string;
  recentNews: string[];
}> {
  try {
    const prompt = `Research the following company and provide business intelligence:

Company: ${companyName}
${domain ? `Domain: ${domain}` : ''}

Provide information in this JSON format:
{
  "industry": "Primary industry/sector",
  "size": "Company size (e.g., Startup, SMB, Mid-market, Enterprise)",
  "description": "Brief company description and business model",
  "recentNews": ["recent news item 1", "recent news item 2", "recent news item 3"]
}`;

    // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are a business intelligence researcher. Provide accurate, current information about companies."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return result;
  } catch (error) {
    console.error('Failed to enhance company data:', error);
    return {
      industry: "Technology",
      size: "Mid-market",
      description: "Technology company focused on innovative solutions",
      recentNews: ["Company continues to expand market presence", "Focus on digital transformation initiatives"]
    };
  }
}
