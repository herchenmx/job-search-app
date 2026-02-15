import { createClient } from '@/lib/supabase/server'
import { Job } from '@/types'
import Link from 'next/link'
import JobsList from './JobsList'

const STATUS_ORDER = [
  'Interested', 'Bookmarked', 'Review', 'Reposted',
  'Applied', 'Referred', 'Followed-Up',
  '1st Stage', '2nd Stage', '3rd Stage', '4th Stage',
  'Offered', 'Signed',
  'Unfit', 'Declined', 'Rejected', 'Closed'
]

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

      {/* Grouped job list with multi-select */}
      {totalJobs > 0 && <JobsList grouped={grouped} />}
    </div>
  )
}
