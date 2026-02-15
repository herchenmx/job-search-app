'use client'

import { useState } from 'react'

export interface Commit {
  sha: string
  shortSha: string
  message: string
  date: string
  url: string
  branch: string | null
}

export default function CommitHistory({ initialCommits, hasMore }: { initialCommits: Commit[]; hasMore: boolean }) {
  const [commits, setCommits] = useState<Commit[]>(initialCommits)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(2)
  const [canLoadMore, setCanLoadMore] = useState(hasMore)

  const handleLoadMore = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/commits?page=${page}`)
      if (res.ok) {
        const data = await res.json()
        setCommits(prev => [...prev, ...data.commits])
        setCanLoadMore(data.hasMore)
        setPage(prev => prev + 1)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Commit History</h3>

      {commits.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No commits found.</p>
      ) : (
        <div className="space-y-0 divide-y divide-gray-100">
          {commits.map(commit => (
            <div key={commit.sha} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <a
                      href={commit.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-blue-600 hover:underline shrink-0"
                    >
                      {commit.shortSha}
                    </a>
                    {commit.branch && (
                      <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-mono">
                        {commit.branch}
                      </span>
                    )}
                  </div>
                  <a
                    href={commit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-900 hover:text-blue-600 transition-colors line-clamp-1"
                  >
                    {commit.message}
                  </a>
                </div>
                <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">
                  {new Date(commit.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' '}
                  {new Date(commit.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {canLoadMore && (
        <button
          onClick={handleLoadMore}
          disabled={loading}
          className="mt-3 text-xs text-blue-600 hover:underline disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Load more commits'}
        </button>
      )}
    </div>
  )
}
