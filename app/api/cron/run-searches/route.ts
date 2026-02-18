export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { JobSearch } from '@/types'

// ── LinkedIn URL builder (ported from Workflow #3 JS) ─────────────────────────

function buildLinkedInUrl(search: JobSearch): string {
  let url = 'https://www.linkedin.com/jobs/search/?f_TPR=r86400'

  if (search.keyword) {
    // Wrap in quotes for exact phrase matching on LinkedIn
    url += `&keywords=${encodeURIComponent(`"${search.keyword}"`)}`
  }

  if (search.location) {
    url += `&location=${encodeURIComponent(search.location)}`
  }

  if (search.experience_level.length > 0) {
    const expMap: Record<string, string> = {
      'Internship': '1',
      'Entry level': '2',
      'Associate': '3',
      'Mid-Senior level': '4',
      'Director': '5',
      'Executive': '6',
    }
    const codes = search.experience_level
      .map(e => expMap[e])
      .filter(Boolean)
    if (codes.length > 0) url += `&f_E=${codes.join(',')}`
  }

  if (search.work_model.length > 0) {
    const workMap: Record<string, string> = {
      'Remote': '2',
      'Hybrid': '3',
      'On-site': '1',
    }
    const codes = search.work_model
      .map(w => workMap[w])
      .filter(Boolean)
    if (codes.length > 0) url += `&f_WT=${codes.join(',')}`
  }

  if (search.job_type.length > 0) {
    const codes = search.job_type.map(t => t.trim().charAt(0).toUpperCase())
    url += `&f_JT=${codes.join(',')}`
  }

  return url
}

// ── BrightData scrape ─────────────────────────────────────────────────────────

interface BrightDataJob {
  url: string
  job_posting_id: string
  job_title: string
  company_name: string
  company_url: string | null
  job_location: string
  job_summary: string
  job_seniority_level: string | null
  job_employment_type: string | null
}

async function scrapeWithBrightData(urls: string[]): Promise<BrightDataJob[]> {
  const token = process.env.BRIGHTDATA_API_KEY
  if (!token) throw new Error('BRIGHTDATA_API_KEY not set')

  const body = {
    input: urls.map(url => ({ url })),
  }

  const res = await fetch(
    'https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_lpfll7v5hcqtkxl6l&notify=false&include_errors=true&type=discover_new&discover_by=url',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  const text = await res.text()

  if (!res.ok) {
    throw new Error(`BrightData error ${res.status}: ${text}`)
  }

  // BrightData returns NDJSON (one JSON object per line)
  return text
    .split('\n')
    .filter((line: string) => line.trim().length > 0)
    .flatMap((line: string) => {
      try {
        const parsed = JSON.parse(line)
        // Could be a single object or an array
        return Array.isArray(parsed) ? parsed : [parsed]
      } catch {
        return []
      }
    })
    .filter((item: BrightDataJob) => item && item.job_title && !('error' in item))
}

// ── Dedup helpers (ported from n8n Workflow #7) ──────────────────────────────

function normalizeUrl(url: string): string {
  return url.toLowerCase().trim().replace(/\/+$/, '')
}

function calculateSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase().trim()
  const s2 = b.toLowerCase().trim()
  if (s1 === s2) return 1
  if (s1.length === 0 || s2.length === 0) return 0

  const len1 = s1.length
  const len2 = s2.length

  // Two-row Levenshtein (avoids strict-mode indexing issues with 2D arrays)
  let prev = Array.from({ length: len2 + 1 }, (_, j) => j)
  let curr = new Array<number>(len2 + 1)

  for (let i = 1; i <= len1; i++) {
    curr[0] = i
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      curr[j] = Math.min(
        prev[j]! + 1,
        curr[j - 1]! + 1,
        prev[j - 1]! + cost
      )
    }
    ;[prev, curr] = [curr, prev]
  }

  return 1 - prev[len2]! / Math.max(len1, len2)
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // ── ALL CRON JOBS PERMANENTLY DISABLED ──
  // Crons removed from vercel.json and hard-disabled here as a safety net.
  // To re-enable: set CRONS_DISABLED to false AND re-add schedules to vercel.json.
  const CRONS_DISABLED = true
  if (CRONS_DISABLED || process.env.CRONS_PAUSED === 'true') {
    return NextResponse.json({ message: 'Cron jobs are permanently disabled' })
  }

  // Verify this is called by Vercel cron (or allow in dev)
  const authHeader = request.headers.get('authorization')
  if (
    process.env.NODE_ENV === 'production' &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use service role key to bypass RLS (cron runs as system, not as a user)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. Load all active searches across all users
  const { data: searches, error: searchError } = await supabase
    .from('job_searches')
    .select('*')
    .eq('is_active', true)

  if (searchError) {
    return NextResponse.json({ error: searchError.message }, { status: 500 })
  }

  if (!searches || searches.length === 0) {
    return NextResponse.json({ message: 'No active searches' })
  }

  // 2. Build one LinkedIn URL per search
  const searchUrls = searches.map((s: JobSearch) => ({
    search: s,
    url: buildLinkedInUrl(s),
  }))

  // 3. Collect all unique URLs and scrape with BrightData in one call
  const uniqueUrls = [...new Set(searchUrls.map(s => s.url))]

  let jobs: BrightDataJob[] = []
  try {
    jobs = await scrapeWithBrightData(uniqueUrls)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'BrightData failed' },
      { status: 500 }
    )
  }

  // 4. Load unwanted keywords for all users with active searches
  const userIds = [...new Set(searches.map((s: JobSearch) => s.user_id))]
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('user_id, unwanted_keywords')
    .in('user_id', userIds)

  // Build a map of user_id → lowercased unwanted keywords
  const unwantedKeywordsMap = new Map<string, string[]>()
  for (const profile of (profiles || [])) {
    const keywords = (profile.unwanted_keywords || [])
      .map((k: string) => k.toLowerCase().trim())
      .filter((k: string) => k.length > 0)
    if (keywords.length > 0) {
      unwantedKeywordsMap.set(profile.user_id, keywords)
    }
  }

  // Helper: check if a job matches any unwanted keyword for a user
  function matchesUnwantedKeyword(job: BrightDataJob, userId: string): string | null {
    const keywords = unwantedKeywordsMap.get(userId)
    if (!keywords || keywords.length === 0) return null

    const title = (job.job_title || '').toLowerCase()
    const summary = (job.job_summary || '').toLowerCase()
    const company = (job.company_name || '').toLowerCase()

    for (const keyword of keywords) {
      if (title.includes(keyword) || summary.includes(keyword) || company.includes(keyword)) {
        return keyword
      }
    }
    return null
  }

  // 5. Pre-load all existing jobs per user for duplicate detection
  const existingJobsByUser = new Map<string, Array<{
    id: string
    posting_url: string
    job_title: string
    linkedin_company_page: string | null
    status: string
    application_date: string | null
    prioritisation_score: number | null
    experience_match_rate: number | null
    job_match_rate: number | null
    job_match_insights: string | null
    experience_match_insights: string | null
    job_description: string | null
    tailored_covering_letter: string | null
    salary_expectation: number | null
    companies: { cultural_match_rate: number | null } | null
  }>>()

  for (const uid of userIds) {
    const { data: userJobs } = await supabase
      .from('jobs')
      .select(`
        id, posting_url, job_title, linkedin_company_page,
        status, application_date, prioritisation_score,
        experience_match_rate, job_match_rate, job_match_insights,
        experience_match_insights, job_description, tailored_covering_letter,
        salary_expectation,
        companies(cultural_match_rate)
      `)
      .eq('user_id', uid)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    existingJobsByUser.set(uid, (userJobs || []) as any)
  }

  // 6. Process scraped jobs: filter, dedup, insert
  const results = { inserted: 0, skipped: 0, blocked: 0, reopened: 0, errors: [] as string[] }

  for (const job of jobs) {
    // Find which search(es) this job belongs to
    const matchingSearches = searchUrls.filter(s => {
      const discoveryUrl = (job as BrightDataJob & { discovery_input?: { url: string } })
      return s.url === (discoveryUrl as unknown as { discovery_input?: { url: string } })?.discovery_input?.url
    })

    const userId = matchingSearches[0]?.search.user_id
    if (!userId) continue

    // 5a. Check against unwanted keywords — block before any DB writes
    const matchedKeyword = matchesUnwantedKeyword(job, userId)
    if (matchedKeyword) {
      results.blocked++
      continue
    }

    // Clean up company URL (strip LinkedIn tracking params)
    const linkedinCompanyPage = job.company_url
      ? job.company_url.replace('?trk=public_jobs_topcard-org-name', '')
      : null

    // 6. Upsert company: check by name + user_id
    let companyId: string | null = null
    if (job.company_name) {
      const { data: existing } = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', userId)
        .eq('name', job.company_name)
        .single()

      if (existing) {
        companyId = existing.id
      } else {
        const { data: newCompany } = await supabase
          .from('companies')
          .insert({
            user_id: userId,
            name: job.company_name,
            linkedin_page: linkedinCompanyPage ?? '',
          })
          .select('id')
          .single()
        companyId = newCompany?.id ?? null
      }
    }

    // 7. Duplicate detection (ported from n8n Workflow #7)
    const postingUrl = job.url
    const normalizedNewUrl = normalizeUrl(postingUrl)
    const userExistingJobs = existingJobsByUser.get(userId) || []

    // Match Strategy 1: Exact normalized posting URL
    let matchedExisting = userExistingJobs.find(
      ej => normalizeUrl(ej.posting_url) === normalizedNewUrl
    )

    // Match Strategy 2: Same company (by linkedin_company_page) + similar title (>=85%)
    if (!matchedExisting && linkedinCompanyPage) {
      const normalizedNewCompanyUrl = normalizeUrl(linkedinCompanyPage)
      matchedExisting = userExistingJobs.find(ej => {
        if (!ej.linkedin_company_page) return false
        if (normalizeUrl(ej.linkedin_company_page) !== normalizedNewCompanyUrl) return false
        return calculateSimilarity(job.job_title, ej.job_title) >= 0.85
      })
    }

    if (matchedExisting) {
      const existingStatus = matchedExisting.status
      const culturalMatchRate = matchedExisting.companies?.cultural_match_rate ?? 0
      const experienceMatchRate = matchedExisting.experience_match_rate ?? 0
      const prioritisationScore = matchedExisting.prioritisation_score ?? 0

      if (existingStatus === 'Closed') {
        // Scenario 1: Closed with high scores → reactivate as Bookmarked
        if (culturalMatchRate >= 60 && experienceMatchRate >= 70 && prioritisationScore >= 70) {
          await supabase.from('jobs').update({ status: 'Bookmarked' }).eq('id', matchedExisting.id)
          results.reopened++
          continue
        }
        // Scenario 2: Closed with low scores → skip
        results.skipped++
        continue

      } else if (
        ['Rejected', 'Applied', '1st Stage', '2nd Stage', '3rd Stage'].includes(existingStatus)
      ) {
        // Scenario 3: Previously applied/rejected — check if >7 days ago
        const appDate = matchedExisting.application_date
          ? new Date(matchedExisting.application_date)
          : null
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        if (appDate && appDate < sevenDaysAgo) {
          // Insert as 'Reposted' with analysis data copied from existing
          const { error: insertError } = await supabase.from('jobs').insert({
            user_id: userId,
            company_id: companyId,
            job_title: job.job_title,
            posting_url: postingUrl,
            company: job.company_name,
            linkedin_company_page: linkedinCompanyPage,
            job_description_full: job.job_summary ?? null,
            status: 'Reposted',
            is_live: true,
            job_match_rate: matchedExisting.job_match_rate,
            job_match_insights: matchedExisting.job_match_insights,
            experience_match_rate: matchedExisting.experience_match_rate,
            experience_match_insights: matchedExisting.experience_match_insights,
            job_description: matchedExisting.job_description,
            tailored_covering_letter: matchedExisting.tailored_covering_letter,
            salary_expectation: matchedExisting.salary_expectation,
            prioritisation_score: matchedExisting.prioritisation_score,
          })

          if (insertError) {
            results.errors.push(`${job.job_title}: ${insertError.message}`)
          } else {
            results.inserted++
          }
          continue
        }
        // Application date is recent (<=7 days) or null → skip
        results.skipped++
        continue

      } else {
        // Scenario 4: Any other status (Bookmarked, Review, Interested, etc.) → skip
        results.skipped++
        continue
      }
    }

    // 8. No match found — insert as new with status 'Review'
    const { error: insertError } = await supabase.from('jobs').insert({
      user_id: userId,
      company_id: companyId,
      job_title: job.job_title,
      posting_url: postingUrl,
      company: job.company_name,
      linkedin_company_page: linkedinCompanyPage,
      job_description_full: job.job_summary ?? null,
      status: 'Review',
      is_live: true,
    })

    if (insertError) {
      results.errors.push(`${job.job_title}: ${insertError.message}`)
    } else {
      results.inserted++
    }
  }

  // 9. Update last_run_at for all searches that ran
  const searchIds = searches.map((s: JobSearch) => s.id)
  await supabase
    .from('job_searches')
    .update({ last_run_at: new Date().toISOString() })
    .in('id', searchIds)

  return NextResponse.json({
    message: 'Done',
    searches_run: searches.length,
    jobs_found: jobs.length,
    ...results,
  })
}