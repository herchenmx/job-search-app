import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Job, Company, InterviewTranscript, InterviewAnalysis } from '@/types'
import JobStatusUpdater from './JobStatusUpdater'
import InterviewSection from './InterviewSection'
import CultureAnalysisButton from './CultureAnalysisButton'
import DeleteJobButton from './DeleteJobButton'
import CollapsibleSection from './CollapsibleSection'

// ===== ADDED FOR STATIC EXPORT =====
export async function generateStaticParams() {
  // For static export with authenticated routes, we use a placeholder
  // The actual data will be fetched when the user visits the page
  return [
    { id: 'placeholder' }
  ]
}
// ===== END OF ADDED CODE =====

const STATUS_COLOURS: Record<string, string> = {
  'Interested':   'bg-green-100 text-green-800',
  'Bookmarked':   'bg-blue-100 text-blue-800',
  'Review':       'bg-yellow-100 text-yellow-800',
  'Reposted':     'bg-purple-100 text-purple-800',
  'Applied':      'bg-indigo-100 text-indigo-800',
  'Referred':     'bg-indigo-100 text-indigo-800',
  'Followed-Up':  'bg-indigo-100 text-indigo-800',
  '1st Stage':    'bg-orange-100 text-orange-800',
  '2nd Stage':    'bg-orange-100 text-orange-800',
  '3rd Stage':    'bg-orange-100 text-orange-800',
  '4th Stage':    'bg-orange-100 text-orange-800',
  'Offered':      'bg-green-100 text-green-800',
  'Signed':       'bg-green-100 text-green-800',
  'Unfit':        'bg-gray-100 text-gray-500',
  'Declined':     'bg-red-100 text-red-800',
  'Rejected':     'bg-red-100 text-red-800',
  'Closed':       'bg-gray-100 text-gray-500',
}

function ScoreBar({ score, label }: { score: number | null; label: string }) {
  if (score === null) return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-300">—</span>
    </div>
  )
  const pct = Math.round(score)
  const colour = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-400'
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-medium text-gray-900">{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colour}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
      {children}
    </div>
  )
}

function TextBlock({ text }: { text: string | null }) {
  if (!text) return <p className="text-sm text-gray-400 italic">Not generated yet</p>
  return <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{text}</p>
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: job } = await supabase
    .from('jobs')
    .select('*, companies(*)')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (!job) notFound()

  const company: Company | null = job.companies ?? null

  const { data: transcripts } = await supabase
    .from('interview_transcripts')
    .select('*')
    .eq('job_id', id)
    .order('interview_number')

  const { data: analyses } = await supabase
    .from('interview_analyses')
    .select('*')
    .eq('job_id', id)
    .order('interview_number')

  const { data: recordings } = await supabase
    .from('interview_recordings')
    .select('*')
    .eq('job_id', id)
    .order('interview_number')

  // Find highest interview number across all three tables
  const allNumbers = [
    ...(transcripts || []).map((t: InterviewTranscript) => t.interview_number),
    ...(analyses || []).map((a: InterviewAnalysis) => a.interview_number),
    ...(recordings || []).map((r: { interview_number: number }) => r.interview_number),
  ]
  const maxInterview = allNumbers.length > 0 ? Math.max(...allNumbers) : 0

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back */}
      <Link href="/jobs" className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">
        ← Back to jobs
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{job.job_title}</h2>
            <p className="text-gray-500 mt-0.5">
              {job.company || company?.name || '—'}
            </p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {job.posting_url && (
                <a
                  href={job.posting_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  View posting ↗
                </a>
              )}
              {company?.linkedin_page && (
                <a
                  href={company.linkedin_page}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  LinkedIn ↗
                </a>
              )}
              {!job.is_live && (
                <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full">
                  Posting offline
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOURS[job.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {job.status}
            </span>
            {job.prioritisation_score !== null && (
              <span className="text-xs text-gray-400">
                Priority score: {Math.round(job.prioritisation_score)}
              </span>
            )}
          </div>
        </div>

        {/* Status updater */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between gap-4">
            <JobStatusUpdater jobId={job.id} currentStatus={job.status} currentReason={job.status_reason} />
            <DeleteJobButton jobId={job.id} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Scores */}
        <Section title="Match Scores">
          <div className="space-y-3">
            <ScoreBar score={job.experience_match_rate} label="Experience" />
            <ScoreBar score={job.job_match_rate} label="Role fit" />
            <ScoreBar score={company?.cultural_match_rate ?? null} label="Culture" />
            {job.overall_match_rate !== null && (
              <div className="pt-2 border-t border-gray-100">
                <ScoreBar score={job.overall_match_rate * 100} label="Overall" />
              </div>
            )}
          </div>
        </Section>

        {/* Application details */}
        <Section title="Application">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Added</span>
              <span className="text-gray-900">
                {new Date(job.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Applied</span>
              <span className="text-gray-900">{job.application_date ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Last live check</span>
              <span className="text-gray-900">{job.last_live_check ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Salary expectation</span>
              <span className="text-gray-900">
                {job.salary_expectation ? `€${job.salary_expectation.toLocaleString()}` : '—'}
              </span>
            </div>
            {job.status_reason && (
              <div className="flex justify-between">
                <span className="text-gray-500">Reason</span>
                <span className="text-gray-900">{job.status_reason}</span>
              </div>
            )}
          </div>
        </Section>

        {/* Company culture summary */}
        <Section title="Company Culture">
          {company?.cultural_match_rate !== null && company?.cultural_match_rate !== undefined ? (
            <div>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {company.cultural_match_rate}%
              </div>
              <p className="text-xs text-gray-500 line-clamp-4">
                {company.cultural_match_insights ?? 'No insights yet'}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-400 italic">Not analysed yet</p>
              {company && <CultureAnalysisButton companyId={company.id} />}
            </div>
          )}
        </Section>
      </div>

      {/* Job Summary */}
      <div className="mb-4">
        <Section title="Job Summary">
          <TextBlock text={job.job_description} />
        </Section>
      </div>

      {/* Experience Match Insights */}
      <div className="mb-4">
        <CollapsibleSection title="Experience Match Insights" text={job.experience_match_insights} />
      </div>

      {/* Role Fit Insights */}
      <div className="mb-4">
        <CollapsibleSection title="Role Fit Insights" text={job.job_match_insights} />
      </div>

      {/* Cover Letter */}
      <div className="mb-4">
        <CollapsibleSection title="Tailored Cover Letter" text={job.tailored_covering_letter} />
      </div>

      {/* Interviews */}
      <div className="mb-4">
        <Section title="Interviews">
          <InterviewSection
            jobId={job.id}
            transcripts={transcripts ?? []}
            analyses={analyses ?? []}
            recordings={recordings ?? []}
            maxInterview={maxInterview}
          />
        </Section>
      </div>

      {/* Full Job Description */}
      <CollapsibleSection title="Full Job Description" text={job.job_description_full} />
    </div>
  )
}

// ===== ADDED AT THE BOTTOM FOR STATIC EXPORT =====
export const dynamic = 'force-static'
// ===== END OF ADDED CODE =====