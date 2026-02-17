import { createClient } from '@/lib/supabase/server'
import { Job } from '@/types'
import Link from 'next/link'
import JobsList from './JobsList'
import KeywordsSection from '../searches/KeywordsSection'

const STATUS_ORDER = [
  'Interested', 'Bookmarked', 'Review', 'Reposted',
  'Applied', 'Referred', 'Followed-Up',
  '1st Stage', '2nd Stage', '3rd Stage', '4th Stage',
  'Offered', 'Signed',
  'Unfit', 'Declined', 'Rejected', 'Closed'
]

const ACTIVE_STATUSES = [
  'Applied', 'Referred', 'Followed-Up',
  '1st Stage', '2nd Stage', '3rd Stage', '4th Stage', 'Offered'
]

// Composite filter groups map a dashboard filter key to multiple statuses
const COMPOSITE_FILTERS: Record<string, string[]> = {
  considering: ['Bookmarked', 'Interested'],
  interviewing: ['1st Stage', '2nd Stage', '3rd Stage', '4th Stage'],
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const params = await searchParams
  const statusParam = params.status || ''

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: jobs }, { data: profile }] = await Promise.all([
    supabase
      .from('jobs')
      .select('*, companies(name, cultural_match_rate)')
      .eq('user_id', user!.id)
      .order('prioritisation_score', { ascending: false }),
    supabase
      .from('user_profiles')
      .select('wanted_keywords, unwanted_keywords')
      .eq('user_id', user!.id)
      .single(),
  ])

  const allJobs = (jobs || []) as Job[]
  const totalJobs = allJobs.length
  const activeJobs = allJobs.filter(j => ACTIVE_STATUSES.includes(j.status)).length

  // Resolve the initial filter: either a composite group or a single status
  let initialFilterStatuses: string[] = []
  if (statusParam) {
    const lowerParam = statusParam.toLowerCase()
    if (COMPOSITE_FILTERS[lowerParam]) {
      initialFilterStatuses = COMPOSITE_FILTERS[lowerParam]
    } else {
      // Direct status match (e.g. "Applied", "Review", "Rejected")
      initialFilterStatuses = [statusParam]
    }
  }

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

      {/* Keywords for filtering scraped jobs */}
      <KeywordsSection
        initialWanted={profile?.wanted_keywords ?? []}
        initialUnwanted={profile?.unwanted_keywords ?? []}
      />

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

      {/* Job list with sorting, filtering, search, and multi-select */}
      {totalJobs > 0 && (
        <JobsList
          jobs={allJobs}
          statusOrder={STATUS_ORDER}
          initialFilterStatuses={initialFilterStatuses}
        />
      )}
    </div>
  )
}
