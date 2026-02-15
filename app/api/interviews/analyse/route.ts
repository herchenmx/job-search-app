export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SYSTEM_PROMPT = `## Role & Core Directive
You are an advanced Interview Analysis Agent specialized in analysing and performance-assessing job interviews. You must maintain objectivity, precision, and constructive insight throughout.

---

## Step-by-Step Processing Workflow

### Phase 1: Content Summarization
1. **Interviewer Content Summary**:
   - Extract all questions, prompts, and statements from interviewer(s)
   - Categorize by topic/theme (technical, behavioral, situational, etc.)
   - Note interviewer's tone, framing, and any explicit evaluation criteria mentioned

2. **Interviewee Content Summary**:
   - Summarize all responses provided by candidate
   - Map responses to corresponding interviewer questions
   - Capture key points, claims, examples, and evidence presented

### Phase 2: Performance Analysis & Feedback

#### Analysis Framework:

1. **Content Quality Assessment**:
   - **Relevance**: Match interviewee responses to job requirements (using JD)
   - **Substance**: Depth of answers, use of examples, evidence provided
   - **Structure**: Logical flow, conciseness, completeness
   - **Alignment**: How well responses address the intent behind questions

2. **Delivery & Communication Evaluation**:
   - **Verbal Delivery**: Pace, clarity, volume modulation, use of pauses, filler words, tone
   - **Linguistic Patterns**: Vocabulary level, sentence complexity, active vs. passive voice
   - **Engagement Indicators**: Question asking, interactive listening cues, rapport building

3. **Competency Mapping** (against Job Description):
   - Identify which required skills/knowledge were demonstrated
   - Note gaps between claimed and demonstrated competencies
   - Evaluate cultural fit indicators based on JD priorities

#### Feedback Generation:
Structure feedback as if from the hiring manager/recruiter:

**A. Strengths (What the interviewee did well):**
- List 3-5 specific, evidenced strengths
- Connect to job requirements where applicable

**B. Areas for Improvement:**
- List 3-5 constructive improvement areas
- Provide specific examples from transcript
- Suggest alternative approaches/phrasing

**C. Strategic Recommendations:**
- Actionable advice for future interviews
- Prioritized suggestions (most impactful first)

**D. Overall Assessment:**
- Brief summary of candidate's performance
- Likely perception from interviewer's perspective
- Key decision-influencing factors

---

## Output Format Requirements
1. Structured report with clear sections
2. Timestamps referenced for all examples where available
3. JD-aligned language
4. Balanced perspective (strengths and growth areas)
5. Professional, constructive tone

---

## Special Instructions
- Note when analysis is based on clear evidence versus interpretation
- Account for potential accent, dialect, or cultural communication differences
- Focus on demonstrable performance factors, avoid assumptions`

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { transcript_id } = await request.json()
  if (!transcript_id) return NextResponse.json({ error: 'transcript_id required' }, { status: 400 })

  // Get the transcript — verify ownership via the parent job
  const { data: transcript } = await supabase
    .from('interview_transcripts')
    .select('*, jobs!inner(job_description, job_title, company, user_id)')
    .eq('id', transcript_id)
    .single()

  if (!transcript) return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })

  if (transcript.jobs.user_id !== user.id) {
    return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
  }

  // Job data is already fetched via the join
  const job = transcript.jobs as { job_description: string | null; job_title: string; company: string }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('cv')
    .eq('user_id', user.id)
    .single()

  // Get prior interview analyses for context (interview N gets all previous)
  let priorContext = ''
  if (transcript.interview_number > 1) {
    const { data: priorAnalyses } = await supabase
      .from('interview_analyses')
      .select('interview_number, analysis_text')
      .eq('job_id', transcript.job_id)
      .lt('interview_number', transcript.interview_number)
      .order('interview_number')

    if (priorAnalyses?.length) {
      priorContext = priorAnalyses
        .map(a => `--- Interview ${a.interview_number} Analysis (context only, do not factor into scoring) ---\n${a.analysis_text}`)
        .join('\n\n')
    }
  }

  const userMessage = [
    `Please read this interview transcript, summarise & analyse it for me:`,
    ``,
    transcript.transcript_text,
    ``,
    job?.job_description ? `Job Description Summary:\n${job.job_description}` : '',
    profile?.cv ? `Candidate CV:\n${profile.cv}` : '',
    priorContext ? `Prior Interview Context:\n${priorContext}` : '',
  ].filter(Boolean).join('\n\n')

  const deepseekKey = process.env.DEEPSEEK_API_KEY
  if (!deepseekKey) return NextResponse.json({ error: 'DEEPSEEK_API_KEY not set' }, { status: 500 })

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${deepseekKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 4096,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    return NextResponse.json({ error: `DeepSeek error: ${err}` }, { status: 500 })
  }

  const data = await response.json()
  const analysisText = data.choices[0].message.content

  // Save analysis to DB
  const { data: analysis, error: analysisError } = await supabase
    .from('interview_analyses')
    .insert({
      job_id: transcript.job_id,
      transcript_id,
      interview_number: transcript.interview_number,
      analysis_text: analysisText,
    })
    .select()
    .single()

  if (analysisError) {
    return NextResponse.json({ error: analysisError.message }, { status: 500 })
  }

  return NextResponse.json({ analysis_id: analysis.id, analysis_text: analysisText })
}