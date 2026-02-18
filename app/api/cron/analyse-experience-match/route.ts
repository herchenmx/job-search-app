export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseAnalysisResponse } from '@/lib/scoring'
import { trackedFetch } from '@/lib/api-logger'

const SYSTEM_PROMPT = `You are an expert job application analyst specializing in matching candidate profiles to job requirements.

Your task is to:
1. Carefully analyze the job posting content and identify all required skills, experience, qualifications, and responsibilities
2. Review the candidate experience rubric and identify their skills, experience, qualifications, and achievements
3. Calculate an Experience Match Rate (0-100) based on how well the candidate experience aligns with job requirements
4. Provide detailed Experience Match Insights that:
   - Highlight areas where the candidate experience strongly matches the job requirements
   - Identify gaps or missing qualifications
   - Note transferable skills that may be relevant

## SCORING METHOD ##
1. List all explicit and implicit requirements (skills, years, domain knowledge, seniority).
2. Check each requirement against the candidate profile.
3. Calculate: Experience_Score = (Number of Met Requirements / Total Requirements) * 100

### SCORING GUIDELINE FOR "MET" ###
* ✓ Met: Direct, recent, and substantive experience.
* ⚠ Partially Met: Adjacent, older, or limited experience.
* ✗ Not Met: Lacks this experience.

## IMPORTANT RULES ##
- DO NOT HALLUCINATE.
- Return your analysis as JSON with exactly two fields: "experienceMatchRate" (a number 0-100) and "experienceMatchInsights" (a string).
- Do NOT use any quotation marks anywhere in your experienceMatchInsights string.
- Respond with ONLY the JSON object, no other text.`

export async function GET(request: NextRequest) {
  // ── ALL CRON JOBS PERMANENTLY DISABLED ──
  // Crons removed from vercel.json and hard-disabled here as a safety net.
  // To re-enable: set CRONS_DISABLED to false AND re-add schedules to vercel.json.
  const CRONS_DISABLED = true
  if (CRONS_DISABLED || process.env.CRONS_PAUSED === 'true') {
    return NextResponse.json({ message: 'Cron jobs are permanently disabled' })
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

  const deepseekKey = process.env.DEEPSEEK_API_KEY
  if (!deepseekKey) return NextResponse.json({ error: 'DEEPSEEK_API_KEY not set' }, { status: 500 })

  // Only analyse jobs the user is considering (Bookmarked/Interested), not Review
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, company, job_title, job_description_full, user_id')
    .is('experience_match_rate', null)
    .eq('needs_experience_match_reanalysis', false)
    .not('job_description_full', 'is', null)
    .in('status', ['Bookmarked', 'Interested'])
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!jobs || jobs.length === 0) return NextResponse.json({ message: 'No jobs to analyse' })

  const results = { analysed: 0, skipped: 0, errors: [] as string[] }

  for (const job of jobs) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('experience_rubric')
      .eq('user_id', job.user_id)
      .single()

    if (!profile?.experience_rubric) {
      await supabase.from('jobs').update({ needs_experience_match_reanalysis: true }).eq('id', job.id)
      results.skipped++
      continue
    }

    try {
      const response = await trackedFetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${deepseekKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          max_tokens: 1024,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: `Please assess how well my experience matches this job posting.\n\nHere is the Job Description:\n${job.job_description_full}\n\nHere is my experience rubric:\n${profile.experience_rubric}`,
            },
          ],
        }),
      }, { service: 'deepseek', endpoint: '/chat/completions', metadata: { job_id: job.id, analysis: 'experience-match' } })

      if (!response.ok) {
        results.errors.push(`${job.company}: DeepSeek error ${response.status}`)
        continue
      }

      const data = await response.json()
      const text = data.choices[0].message.content

      const parsed = parseAnalysisResponse(text, 'experienceMatchRate', 'experienceMatchInsights')
      if ('error' in parsed) {
        results.errors.push(`${job.company}: ${parsed.error}`)
        continue
      }

      const matchRate = parsed.rate
      const insights = parsed.insights

      const { error: updateError } = await supabase
        .from('jobs')
        .update({ experience_match_rate: matchRate, experience_match_insights: insights, updated_at: new Date().toISOString() })
        .eq('id', job.id)

      if (updateError) {
        results.errors.push(`${job.company}: ${updateError.message}`)
      } else {
        results.analysed++
      }

      await new Promise(resolve => setTimeout(resolve, 3000))
    } catch (err) {
      results.errors.push(`${job.company}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return NextResponse.json({ message: 'Done', jobs_found: jobs.length, ...results })
}