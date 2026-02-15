'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Job } from '@/types'

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

export default function JobsList({
  grouped,
}: {
  grouped: Record<string, Job[]>
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const router = useRouter()

  const toggleSelect = (jobId: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(jobId)) next.delete(jobId)
      else next.add(jobId)
      return next
    })
  }

  const toggleSelectAll = (statusJobs: Job[]) => {
    setSelected(prev => {
      const next = new Set(prev)
      const allSelected = statusJobs.every(j => next.has(j.id))
      if (allSelected) {
        statusJobs.forEach(j => next.delete(j.id))
      } else {
        statusJobs.forEach(j => next.add(j.id))
      }
      return next
    })
  }

  const handleBulkDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch('/api/jobs/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobIds: Array.from(selected) }),
      })
      if (res.ok) {
        setSelected(new Set())
        setConfirming(false)
        router.refresh()
      }
    } catch {
      // ignore
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <span className="text-sm text-red-800 font-medium">
            {selected.size} job{selected.size > 1 ? 's' : ''} selected
          </span>
          {confirming ? (
            <>
              <span className="text-xs text-red-600">Are you sure?</span>
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="text-xs bg-white text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 border border-gray-300 transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setConfirming(true)}
                className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete selected
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                Clear selection
              </button>
            </>
          )}
        </div>
      )}

      {/* Grouped job list */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([status, statusJobs]) => {
          const allSelected = statusJobs.every(j => selected.has(j.id))
          return (
            <div key={status}>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => toggleSelectAll(statusJobs)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {status} ({statusJobs.length})
                </h3>
              </div>
              <div className="space-y-2">
                {statusJobs.map((job: Job) => (
                  <div
                    key={job.id}
                    className="flex items-center gap-3"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(job.id)}
                      onChange={() => toggleSelect(job.id)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                    />
                    <Link
                      href={`/jobs/${job.id}`}
                      className="flex-1 block bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all"
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
                            <span className="text-gray-300 mx-1.5">·</span>
                            <span className="text-xs text-gray-400">
                              Added {new Date(job.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
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
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
