import { createClient } from '@/lib/supabase/server'
import { Company } from '@/types'
import CompaniesList from './CompaniesList'

export default async function CompaniesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: companies } = await supabase
    .from('companies')
    .select('*, jobs(count)')
    .eq('user_id', user!.id)
    .order('name')

  const allCompanies = (companies || []) as (Company & { jobs: { count: number }[] })[]
  const totalCompanies = allCompanies.length

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

      {totalCompanies > 0 && <CompaniesList companies={allCompanies} />}
    </div>
  )
}
