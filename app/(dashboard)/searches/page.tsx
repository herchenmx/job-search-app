import { createClient } from '@/lib/supabase/server'
import { JobSearch } from '@/types'
import Link from 'next/link'
import SearchToggle from './SearchToggle'

export default async function SearchesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: searches } = await supabase
    .from('job_searches')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  const totalSearches = searches?.length ?? 0
  const activeSearches = searches?.filter((s: JobSearch) => s.is_active).length ?? 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Searches</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeSearches} active · {totalSearches} total
          </p>
        </div>
        <Link
          href="/searches/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + New search
        </Link>
      </div>

      {totalSearches === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-4xl mb-3">🔍</p>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No searches yet</h3>
          <p className="text-gray-500 text-sm mb-4">
            Create a search to automatically find jobs matching your criteria.
          </p>
          <Link
            href="/searches/new"
            className="text-blue-600 text-sm font-medium hover:underline"
          >
            Create your first search →
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {searches?.map((search: JobSearch) => (
          <div
            key={search.id}
            className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Link
                    href={`/searches/${search.id}`}
                    className="font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                  >
                    {search.label}
                  </Link>
                  <SearchToggle searchId={search.id} isActive={search.is_active} />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-gray-400">Keyword:</span>
                    <p className="text-gray-700 font-medium">{search.keyword}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Location:</span>
                    <p className="text-gray-700 font-medium">{search.location}</p>
                  </div>
                  {search.experience_level.length > 0 && (
                    <div>
                      <span className="text-gray-400">Experience:</span>
                      <p className="text-gray-700 font-medium">{search.experience_level.join(', ')}</p>
                    </div>
                  )}
                  {search.work_model.length > 0 && (
                    <div>
                      <span className="text-gray-400">Work model:</span>
                      <p className="text-gray-700 font-medium">{search.work_model.join(', ')}</p>
                    </div>
                  )}
                </div>

                {search.last_run_at && (
                  <p className="text-xs text-gray-400 mt-3">
                    Last run: {new Date(search.last_run_at).toLocaleString()}
                  </p>
                )}
              </div>

              <Link
                href={`/searches/${search.id}`}
                className="text-sm text-blue-600 hover:underline shrink-0"
              >
                Edit →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}