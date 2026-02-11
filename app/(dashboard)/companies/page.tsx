import { createClient } from '@/lib/supabase/server'
import { Company } from '@/types'
import Link from 'next/link'

export default async function CompaniesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: companies } = await supabase
    .from('companies')
    .select('*, jobs(count)')
    .eq('user_id', user!.id)
    .order('name')

  const totalCompanies = companies?.length ?? 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Companies</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalCompanies} companies tracked
          </p>
        </div>
      </div>

      {totalCompanies === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-4xl mb-3">🏢</p>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No companies yet</h3>
          <p className="text-gray-500 text-sm mb-4">
            Companies will appear here automatically when you add jobs.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {companies?.map((company: Company & { jobs: { count: number }[] }) => {
          const jobCount = company.jobs?.[0]?.count ?? 0
          const hasScore = company.cultural_match_rate !== null && company.cultural_match_rate !== undefined
          const score = hasScore ? company.cultural_match_rate : null

          return (
            <Link
              key={company.id}
              href={`/companies/${company.id}`}
              className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="font-semibold text-gray-900 text-base">{company.name}</h3>
                {score !== null && (
                  <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                    score >= 80 ? 'bg-green-100 text-green-800' :
                    score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {score}%
                  </span>
                )}
              </div>

              <div className="space-y-1 text-sm text-gray-500">
                {company.linkedin_page && (
                  <p className="truncate">
                    🔗 LinkedIn
                  </p>
                )}
                <p>
                  💼 {jobCount} {jobCount === 1 ? 'job' : 'jobs'}
                </p>
                {score !== null && company.cultural_match_insights && (
                  <p className="line-clamp-2 text-xs">
                    {company.cultural_match_insights.substring(0, 120)}…
                  </p>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}