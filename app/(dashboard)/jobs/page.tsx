import { createClient } from '@/lib/supabase/server'
import { Job } from '@/types'
import Link from 'next/link'

const STATUS_ORDER = [
  'Interested', 'Bookmarked', 'Review', 'Reposted',
  'Applied', 'Referred', 'Followed-Up',
  '1st Stage', '2nd Stage', '3rd Stage', '4th Stage',
  'Offered', 'Signed',
  'Unfit', 'Declined', 'Rejected', 'Closed'
]

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

function ScoreBadge({ score, label }: { score: number | null; label: string }) {
  if (score === null) return null
  const pct = Math.round(score)
  const colour = pct >= 80 ? 'text-green-700' : pct >= 60 ? 'text-yellow-700' : 'text-red-700'
  return (
    <span className={`text-xs ${colour}`}>
      {label} {pct}%
    </span>
  )
}

export default async function JobsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: jobs } = await supabase
    .from('jobs')
    .select('*, companies(name, cultural_match_rate)')
    .eq('user_id', user!.id)
    .order('prioritisation_score', { ascending: false })

  const grouped = STATUS_ORDER.reduce((acc, status) => {
    const statusJobs = (jobs || []).filter((j: Job) => j.status === status)
    if (statusJobs.length > 0) acc[status] = statusJobs
    return acc
  }, {} as Record<string, Job[]>)

  const totalJobs = jobs?.length ?? 0
  const activeJobs = jobs?.filter((j: Job) =>
    ['Applied', 'Referred', 'Followed-Up', '1st Stage', '2nd Stage', '3rd Stage', '4th Stage', 'Offered'].includes(j.status)
  ).length ?? 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Jobs</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalJobs} total · {activeJobs} active applications
          </p>
        </div>
        <Link
          href="/jobs/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Add job
        </Link>
      </div>

      {/* Empty state */}
      {totalJobs === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-4xl mb-3">💼</p>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No jobs yet</h3>
          <p className="text-gray-500 text-sm mb-4">
            Add a job manually or run a search to get started.
          </p>
          <Link
            href="/searches"
            className="text-blue-600 text-sm font-medium hover:underline"
          >
            Set up a job search →
          </Link>
        </div>
      )}

      {/* Grouped job list */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([status, statusJobs]) => (
          <div key={status}>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              {status} ({statusJobs.length})
            </h3>
            <div className="space-y-2">
              {statusJobs.map((job: Job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm">
                          {job.job_title}
                        </span>
                        {!job.is_live && (
                          <span className="text-xs bg-red-50 text-red-500 px-1.5 py-0.5 rounded">
                            Offline
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {job.company || job.companies?.name || '—'}
                      </p>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <ScoreBadge score={job.experience_match_rate} label="Exp" />
                        <ScoreBadge score={job.job_match_rate} label="Role" />
                        <ScoreBadge
                          score={job.companies?.cultural_match_rate ?? null}
                          label="Culture"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOURS[status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {status}
                      </span>
                      {job.prioritisation_score !== null && (
                        <span className="text-xs text-gray-400">
                          Score: {Math.round(job.prioritisation_score)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
