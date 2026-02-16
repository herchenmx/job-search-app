export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseAnalysisResponse } from '@/lib/scoring'

const SYSTEM_PROMPT = `You are an expert job application analyst specializing in matching candidate's organisational culture preferences with companies.

Your task is to:
1. Find the Company's LinkedIn page, if you can
2. Find the Company's website, if you can
3. Carefully analyze the culture of the company, by looking at their website and their LinkedIn Page, and identify key themes.
4. Find the Company on Kununu, if you can
5. Find the Company on Glassdoor, if you can
6. If you could do 4 & 5, carefully analyse what current and previous employees say about the company culture on places like Kununu and Glassdoor, and identify key themes.
7. Review the candidate's organisational culture preferences
8. Calculate a Culture Match Rate (0-100) based on how well the candidate organisational culture preferences align with the company culture (as described by the company themselves, and by the employees feedback if possible)
9. Provide detailed Culture Match Insights that:
   - Highlight areas where there is a strong overlap
   - Identify gaps or missing qualifications
   - Note any red flags you spot
   - Be specific with examples from both the job posting and CV

## IMPORTANT RULES ##
- Return your analysis as JSON with exactly two fields: "culturalMatchRate" (a number 0-100) and "culturalMatchInsights" (a string).
- DO NOT HALLUCINATE.
- Do NOT use any quotation marks anywhere in your culturalMatchInsights string.
- If you cannot fully conduct the analysis on the company culture, work with what you have.
- Keep your culturalMatchInsights to 2000 characters maximum.
- Respond with ONLY the JSON object, no other text.`

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { companyId } = await request.json()
  if (!companyId) return NextResponse.json({ error: 'companyId is required' }, { status: 400 })

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })

  // Get company
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, name, linkedin_page, user_id')
    .eq('id', companyId)
    .eq('user_id', user.id)
    .single()

  if (companyError || !company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  // Get user's culture preferences rubric
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('culture_preferences_rubric')
    .eq('user_id', user.id)
    .single()

  if (!profile?.culture_preferences_rubric) {
    return NextResponse.json(
      { error: 'Please set up your culture preferences rubric in your profile first.' },
      { status: 400 }
    )
  }

  // Call Claude with web search
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [
          {
            role: 'user',
            content: `Please find out how much my organisational culture preference and the company culture match. Please consider seeking out employee feedback.

The company in question is ${company.name},
Their LinkedIn page is ${company.linkedin_page || 'not available'} and
the Cultural Preferences are here: ${profile.culture_preferences_rubric}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: `Anthropic error ${response.status}` }, { status: 500 })
    }

    const data = await response.json()

    const textContent = data.content
      ?.filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('')

    if (!textContent) {
      return NextResponse.json({ error: 'No text in response' }, { status: 500 })
    }

    const parsed = parseAnalysisResponse(textContent, 'culturalMatchRate', 'culturalMatchInsights')
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 500 })
    }

    const matchRate = parsed.rate
    const insights = parsed.insights

    // Save to companies table
    const { error: updateError } = await supabase
      .from('companies')
      .update({
        cultural_match_rate: matchRate,
        cultural_match_insights: insights,
        needs_culture_reanalysis: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', company.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Analysis complete',
      culturalMatchRate: matchRate,
      culturalMatchInsights: insights,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
