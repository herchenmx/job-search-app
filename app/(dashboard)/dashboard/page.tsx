import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const INTERVIEWING_STATUSES = [
  '1st Stage', '2nd Stage', '3rd Stage', '4th Stage',
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, status')
    .eq('user_id', user!.id)

  const allJobs = jobs || []

  const reviewCount = allJobs.filter(j => j.status === 'Review').length
  const appliedCount = allJobs.filter(j => j.status === 'Applied').length
  const interviewingCount = allJobs.filter(j =>
    INTERVIEWING_STATUSES.includes(j.status)
  ).length
  const rejectedCount = allJobs.filter(j => j.status === 'Rejected').length

  const cards: {
    label: string
    count: number
    color: string
    bgColor: string
    icon: string
    filterStatus: string
  }[] = [
    {
      label: 'To review',
      count: reviewCount,
      color: 'text-amber-700',
      bgColor: 'bg-amber-50 border-amber-200',
      icon: '📋',
      filterStatus: 'Review',
    },
    {
      label: 'Applied',
      count: appliedCount,
      color: 'text-blue-700',
      bgColor: 'bg-blue-50 border-blue-200',
      icon: '📨',
      filterStatus: 'Applied',
    },
    {
      label: 'Interviewing',
      count: interviewingCount,
      color: 'text-violet-700',
      bgColor: 'bg-violet-50 border-violet-200',
      icon: '🎙️',
      filterStatus: 'interviewing',
    },
    {
      label: 'Rejected',
      count: rejectedCount,
      color: 'text-red-700',
      bgColor: 'bg-red-50 border-red-200',
      icon: '✗',
      filterStatus: 'Rejected',
    },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Overview of your job search pipeline.
        </p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href="/jobs"
            className={`border rounded-xl p-5 ${card.bgColor} hover:shadow-sm transition-shadow`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{card.icon}</span>
            </div>
            <p className={`text-3xl font-bold ${card.color}`}>{card.count}</p>
            <p className="text-sm text-gray-600 mt-1">{card.label}</p>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick actions</h3>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/jobs/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Add a job
          </Link>
          <Link
            href="/searches"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            🔍 Job searches
          </Link>
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            👤 Profile
          </Link>
        </div>
      </div>
    </div>
  )
}
