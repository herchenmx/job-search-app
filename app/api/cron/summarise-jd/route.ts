export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SYSTEM_PROMPT = `You are a precise summarization engine. Your task is to create a structured, bulleted summary of a provided job description for storage in a database.

Core Instruction: Generate a summary under 2000 characters (formatting counts towards this too!) by extracting and condensing the following four elements from the input. Use the exact section headers and format provided below. Do not under any circumstances hallucinate!

Output Format & Required Sections:
Structure your response exactly as follows. Do not add any text before, between, or after these sections.

Company: [Provide a 1-2 high-level overview of the company/organization in bullet points.]

Role Mission/Purpose: [State the core objective and impact of this position in 1-2 bullet points.]

Key Responsibilities: [List 3-5 essential duties. Use bullet points here.]
• Responsibility one.
• Responsibility two.
• Responsibility three.

Key Applicant Requirements: [List 3-5 must-have skills, qualifications, or experiences. Use bullet points here.]
• Requirement one.
• Requirement two.
• Requirement three.

Critical Style & Format Rules:
- Use clear, concise, and professional language.
- Do NOT hallucinate.
- Use only the section headers as shown and bullet points (•) for lists.
- Do not use markdown (##, ** for bold), numbered lists, or any other styling.
- Do not include the job title, introductory/closing phrases, or meta-commentary.
- Begin directly with the first header (Company:).
- The 2000-character limit is mandatory. Prioritize key information.

Validation Step: Before finalizing your response, check it against all rules: correct headers, bullet format, no markdown, no extraneous text, and character count. Do not return output unless validated.`

export async function GET(request: NextRequest) {
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

  // Fetch jobs missing a JD summary, with full description available
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, job_description_full, company')
    .is('job_description', null)
    .eq('needs_jd_summary_reanalysis', false)
    .not('job_description_full', 'is', null)
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!jobs || jobs.length === 0) return NextResponse.json({ message: 'No jobs to summarise' })

  const results = { summarised: 0, skipped: 0, errors: [] as string[] }

  for (const job of jobs) {
    if (!job.job_description_full?.trim()) {
      await supabase.from('jobs').update({ needs_jd_summary_reanalysis: true }).eq('id', job.id)
      results.skipped++
      continue
    }

    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
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
            { role: 'user', content: `Please summarise this job description:\n\n${job.job_description_full}` },
          ],
        }),
      })

      if (!response.ok) {
        results.errors.push(`${job.company}: DeepSeek error ${response.status}`)
        continue
      }

      const data = await response.json()
      const summary = data.choices[0].message.content
        ?.replaceAll('"', '')
        .replaceAll('**', '')
        .replaceAll('*', '')
        .substring(0, 2000)

      if (!summary) {
        results.errors.push(`${job.company}: Empty response`)
        continue
      }

      const { error: updateError } = await supabase
        .from('jobs')
        .update({ job_description: summary, updated_at: new Date().toISOString() })
        .eq('id', job.id)

      if (updateError) {
        results.errors.push(`${job.company}: ${updateError.message}`)
      } else {
        results.summarised++
      }

      await new Promise(resolve => setTimeout(resolve, 3000))
    } catch (err) {
      results.errors.push(`${job.company}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return NextResponse.json({ message: 'Done', jobs_found: jobs.length, ...results })
}