export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
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

export async function GET(request: NextRequest) {
  // Kill switch — set CRONS_PAUSED=true in Vercel env to pause all cron jobs
  if (process.env.CRONS_PAUSED === 'true') {
    return NextResponse.json({ message: 'Crons are paused' })
  }

  const authHeader = request.headers.get('authorization')
  if (
    process.env.NODE_ENV === 'production' &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
  }

  // 1. Get all unassessed companies (no cultural_match_rate yet), grouped by user
  // Process max 4 per run to stay within Anthropic's 5 RPM limit
  // (15s delay between calls = 4 calls in ~60s = safe within Vercel timeout)
  // Exclude companies flagged as needing reanalysis (rubric was missing when last attempted)
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, linkedin_page, user_id')
    .is('cultural_match_rate', null)
    .eq('needs_culture_reanalysis', false)
    .order('name', { ascending: true })
    .limit(4)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!companies || companies.length === 0) {
    return NextResponse.json({ message: 'No companies to analyse' })
  }

  const results = { analysed: 0, skipped: 0, errors: [] as string[] }

  for (const company of companies) {
    // 2. Get user's culture preferences rubric
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('culture_preferences_rubric')
      .eq('user_id', company.user_id)
      .single()

    if (!profile?.culture_preferences_rubric) {
      // Flag so cron skips this company until rubric is added
      await supabase
        .from('companies')
        .update({ needs_culture_reanalysis: true })
        .eq('id', company.id)
      results.skipped++
      continue
    }

    // 3. Call Claude with web search
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
        const err = await response.text()
        results.errors.push(`${company.name}: Anthropic error ${response.status}`)
        continue
      }

      const data = await response.json()

      // Extract the text content from response (last text block)
      const textContent = data.content
        ?.filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text)
        .join('')

      if (!textContent) {
        results.errors.push(`${company.name}: No text in response`)
        continue
      }

      // Parse JSON from Claude's response
      const parsed = parseAnalysisResponse(textContent, 'culturalMatchRate', 'culturalMatchInsights')
      if ('error' in parsed) {
        results.errors.push(`${company.name}: ${parsed.error}`)
        continue
      }

      const matchRate = parsed.rate
      const insights = parsed.insights

      // 4. Save back to companies table
      const { error: updateError } = await supabase
        .from('companies')
        .update({
          cultural_match_rate: matchRate,
          cultural_match_insights: insights,
          updated_at: new Date().toISOString(),
        })
        .eq('id', company.id)

      if (updateError) {
        results.errors.push(`${company.name}: ${updateError.message}`)
      } else {
        results.analysed++
      }

      // Rate limiting — 15s between calls (Anthropic limit: 5 RPM)
      await new Promise(resolve => setTimeout(resolve, 15000))

    } catch (err) {
      results.errors.push(`${company.name}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return NextResponse.json({
    message: 'Done',
    companies_found: companies.length,
    ...results,
  })
}