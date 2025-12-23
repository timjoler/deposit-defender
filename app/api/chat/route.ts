import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: Request) {
  try {
    const { text, context } = await req.json();

    // Debug: Log environment variable status
    const hasKey = !!process.env.OPENAI_API_KEY;
    const keyLength = process.env.OPENAI_API_KEY?.length || 0;
    const keyPrefix = process.env.OPENAI_API_KEY?.substring(0, 7) || 'none';
    
    console.log('Environment check:', {
      hasKey,
      keyLength,
      keyPrefix,
      allEnvKeys: Object.keys(process.env).filter(k => k.includes('OPENAI')),
    });

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { 
          error: 'OPENAI_API_KEY is not configured. Please add it to your .env.local file and restart the server.',
          debug: { hasKey, keyLength, keyPrefix }
        },
        { status: 500 }
      );
    }

    // Initialize OpenAI with your key (lazy initialization)
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const systemPrompt = `
      You are helping a tenant draft a letter to their landlord about a deposit dispute.
      
      YOUR TASK:
      Analyze the landlord's email and the tenant's context.
      Draft a letter written from the TENANT'S perspective (using "I", not "we").
      Return a JSON object (NO MARKDOWN).
      
      CRITICAL: The letter must be written in FIRST PERSON from the tenant's perspective.
      - Use "I" and "my" throughout
      - Do NOT write as a solicitor or use "we"
      - The tenant is writing this letter themselves
      - Keep it professional but personal
      
      LEGAL FRAMEWORK:
      - Tenant Fees Act 2019: Bans professional cleaning fees.
      - Landlord & Tenant Act 1985 (Sec 11): Landlord repairs structure/exterior.
      - Housing Act 2004: Deposit protection rules.
      - Principle of Betterment: Landlord cannot charge "New for Old" for wear and tear, but CAN charge full replacement cost for tenant-caused damage.
      
      SCENARIO LOGIC (CRITICAL):
      1. If Context = "Innocent/Dispute": Assume landlord is exaggerating. Cite Acts aggressively. Strength = High.
      2. If Context = "Guilty/Mitigate": 
         - For WEAR AND TEAR items (carpets, paint, general wear): Argue "Apportionment" (Depreciation/Betterment) to lower cost. Strength = Medium.
         - For CLEAR TENANT DAMAGE (broken windows from party, smashed doors, deliberate damage): Tenant must pay FULL replacement cost. Betterment does NOT apply. Strength = Low.
      3. STRENGTH = LOW when:
         - Clear, admitted tenant fault (broken windows, smashed items, deliberate damage)
         - Damage that cannot be argued as wear and tear
         - Tenant admits responsibility but disputes only the amount (where amount is reasonable)
         - Cases where betterment/depreciation arguments don't apply
      
      IMPORTANT: Broken windows, smashed items, party damage, deliberate damage = tenant pays FULL cost. No betterment argument. Strength = Low.
      
      OUTPUT JSON STRUCTURE:
      {
        "strength": "High" | "Medium" | "Low",
        "act_cited": "Name of Act (e.g. Tenant Fees Act 2019) or 'N/A' for Low cases",
        "summary": "2 sentence explanation of the legal standing.",
        "letter": "The full legal draft written in first person from the tenant's perspective..."
      }
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Landlord Text: "${text}"\nTenant Context: "${context}"` },
      ],
      response_format: { type: "json_object" }, // This guarantees valid JSON
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("No content generated");

    return NextResponse.json(JSON.parse(content));

  } catch (error) {
    console.error('OpenAI Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate draft' },
      { status: 500 }
    );
  }
}

