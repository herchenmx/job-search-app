import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Company, Job } from '@/types'
import DeleteCompanyButton from './DeleteCompanyButton'

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (!company) notFound()

  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('company_id', id)
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  const hasScore = company.cultural_match_rate !== null && company.cultural_match_rate !== undefined
  const score = hasScore ? company.cultural_match_rate : null

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/companies" className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">
        ← Back to companies
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">{company.name}</h2>
            <div className="flex items-center gap-4 mt-1">
              {company.linkedin_page && (
                <a
                  href={company.linkedin_page}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  View on LinkedIn ↗
                </a>
              )}
              <DeleteCompanyButton companyId={company.id} />
            </div>
          </div>
          {score !== null && (
            <div className="text-center">
              <div className={`text-3xl font-bold ${
                score >= 80 ? 'text-green-600' :
                score >= 60 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {score}%
              </div>
              <p className="text-xs text-gray-400 mt-1">Cultural match</p>
            </div>
          )}
        </div>
      </div>

      {/* Cultural insights */}
      {company.cultural_match_insights && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Cultural Match Insights</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {company.cultural_match_insights}
          </p>
        </div>
      )}

      {/* Jobs at this company */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Jobs at {company.name} ({jobs?.length ?? 0})
        </h3>

        {!jobs || jobs.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No jobs found for this company.</p>
        ) : (
          <div className="space-y-3">
            {jobs.map((job: Job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="block border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-gray-50 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 text-sm">{job.job_title}</h4>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span className={`px-2 py-0.5 rounded-full ${
                        job.status === 'Interested' ? 'bg-green-100 text-green-700' :
                        job.status === 'Bookmarked' ? 'bg-blue-100 text-blue-700' :
                        job.status === 'Applied' ? 'bg-indigo-100 text-indigo-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {job.status}
                      </span>
                      {job.prioritisation_score !== null && (
                        <span>Score: {Math.round(job.prioritisation_score)}</span>
                      )}
                    </div>
                  </div>
                  {job.posting_url && (
                    <span className="text-blue-600 text-xs">View →</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}