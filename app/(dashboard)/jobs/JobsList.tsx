'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Job } from '@/types'

type SortField = 'status' | 'added' | 'title' | 'company'
type SortDir = 'asc' | 'desc'

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

function JobCard({ job, status }: { job: Job; status: string }) {
  return (
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
  )
}

export default function JobsList({
  jobs: initialJobs,
  statusOrder,
  initialFilterStatuses = [],
}: {
  jobs: Job[]
  statusOrder: string[]
  initialFilterStatuses?: string[]
}) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [bulkStatus, setBulkStatus] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [sortBy, setSortBy] = useState<SortField>('status')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(
    new Set(initialFilterStatuses)
  )
  const [search, setSearch] = useState('')
  const router = useRouter()
  const supabase = createClient()

  // Processing pipeline: filter → sort
  const processedJobs = useMemo(() => {
    let result = [...jobs]

    // 1. Free-text search
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      result = result.filter(j =>
        j.job_title.toLowerCase().includes(q) ||
        (j.company || '').toLowerCase().includes(q) ||
        (j.companies?.name || '').toLowerCase().includes(q)
      )
    }

    // 2. Status filter (supports multiple statuses)
    if (filterStatuses.size > 0) {
      result = result.filter(j => filterStatuses.has(j.status))
    }

    // 3. Sort
    const dir = sortDir === 'asc' ? 1 : -1
    result.sort((a, b) => {
      switch (sortBy) {
        case 'status': {
          const aIdx = statusOrder.indexOf(a.status)
          const bIdx = statusOrder.indexOf(b.status)
          return (aIdx - bIdx) * dir
        }
        case 'added':
          return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir
        case 'title':
          return a.job_title.localeCompare(b.job_title) * dir
        case 'company': {
          const aName = (a.company || a.companies?.name || '').toLowerCase()
          const bName = (b.company || b.companies?.name || '').toLowerCase()
          return aName.localeCompare(bName) * dir
        }
        default:
          return 0
      }
    })

    return result
  }, [jobs, search, filterStatuses, sortBy, sortDir, statusOrder])

  // Group by status when sorting by status, otherwise flat list
  const grouped = useMemo(() => {
    if (sortBy !== 'status') return null
    const groups: Record<string, Job[]> = {}
    const order = sortDir === 'asc' ? statusOrder : [...statusOrder].reverse()
    for (const status of order) {
      const statusJobs = processedJobs.filter(j => j.status === status)
      if (statusJobs.length > 0) groups[status] = statusJobs
    }
    return groups
  }, [processedJobs, sortBy, sortDir, statusOrder])

  // Unique statuses present in the data (for filter dropdown)
  const availableStatuses = useMemo(() => {
    const statuses = new Set<string>(jobs.map(j => j.status))
    return statusOrder.filter(s => statuses.has(s))
  }, [jobs, statusOrder])

  const toggleSelect = (jobId: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(jobId)) next.delete(jobId)
      else next.add(jobId)
      return next
    })
  }

  const toggleSelectAll = (jobsToToggle: Job[]) => {
    setSelected(prev => {
      const next = new Set(prev)
      const allSelected = jobsToToggle.every(j => next.has(j.id))
      if (allSelected) {
        jobsToToggle.forEach(j => next.delete(j.id))
      } else {
        jobsToToggle.forEach(j => next.add(j.id))
      }
      return next
    })
  }

  const handleBulkDelete = async () => {
    const idsToDelete = Array.from(selected)
    // Optimistic: remove from UI immediately
    setJobs(prev => prev.filter(j => !selected.has(j.id)))
    setSelected(new Set())
    setConfirming(false)
    setDeleting(false)
    try {
      await fetch('/api/jobs/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobIds: idsToDelete }),
      })
    } catch {
      // ignore — already removed from UI
    }
  }

  const handleBulkStatusChange = async () => {
    if (!bulkStatus || selected.size === 0) return
    const idsToUpdate = Array.from(selected)
    const newStatus = bulkStatus as Job['status']
    // Optimistic: update status in UI immediately
    setJobs(prev => prev.map(j => idsToUpdate.includes(j.id) ? { ...j, status: newStatus } : j))
    setSelected(new Set())
    setBulkStatus('')
    setUpdatingStatus(false)
    try {
      await supabase
        .from('jobs')
        .update({ status: bulkStatus })
        .in('id', idsToUpdate)
    } catch {
      // ignore — already updated in UI
    }
  }

  const isFiltered = search.trim() || filterStatuses.size > 0
  const showingCount = processedJobs.length

  return (
    <div>
      {/* Toolbar: search, filter, sort */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search jobs…"
          className="text-sm text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
        />

        {/* Status filter */}
        <select
          value={filterStatuses.size === 1 ? Array.from(filterStatuses)[0] : filterStatuses.size > 1 ? '__multi__' : ''}
          onChange={e => {
            const val = e.target.value
            if (val === '') {
              setFilterStatuses(new Set())
            } else if (val !== '__multi__') {
              setFilterStatuses(new Set([val]))
            }
          }}
          className="text-sm text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          {filterStatuses.size > 1 && (
            <option value="__multi__">{Array.from(filterStatuses).join(', ')}</option>
          )}
          {availableStatuses.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {filterStatuses.size > 0 && (
          <button
            onClick={() => setFilterStatuses(new Set())}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            title="Clear filter"
          >
            ✕
          </button>
        )}

        {/* Sort field */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortField)}
          className="text-sm text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="status">Sort by status</option>
          <option value="added">Sort by added date</option>
          <option value="title">Sort by job title</option>
          <option value="company">Sort by company</option>
        </select>

        {/* Sort direction */}
        <button
          onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
          className="text-sm text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
        >
          {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
        </button>

        {/* Filtered count */}
        {isFiltered && (
          <span className="text-xs text-gray-400 ml-auto">
            Showing {showingCount} of {jobs.length}
          </span>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex-wrap">
          <span className="text-sm text-blue-800 font-medium">
            {selected.size} job{selected.size > 1 ? 's' : ''} selected
          </span>

          <div className="h-4 w-px bg-blue-200" />

          {/* Bulk status change */}
          <select
            value={bulkStatus}
            onChange={e => setBulkStatus(e.target.value)}
            className="text-xs text-gray-900 border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Change status to…</option>
            {statusOrder.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={handleBulkStatusChange}
            disabled={!bulkStatus || updatingStatus}
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {updatingStatus ? 'Updating…' : 'Apply'}
          </button>

          <div className="h-4 w-px bg-blue-200" />

          {/* Bulk delete */}
          {confirming ? (
            <>
              <span className="text-xs text-red-600">Delete? This cannot be undone.</span>
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
                No
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="text-xs text-red-600 hover:text-red-700 transition-colors"
            >
              Delete selected
            </button>
          )}

          <button
            onClick={() => { setSelected(new Set()); setConfirming(false); setBulkStatus('') }}
            className="text-xs text-gray-500 hover:text-gray-700 transition-colors ml-auto"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* No results */}
      {processedJobs.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 text-sm">No jobs match your filters.</p>
        </div>
      )}

      {/* Grouped by status */}
      {grouped && (
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
                    <div key={job.id} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selected.has(job.id)}
                        onChange={() => toggleSelect(job.id)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                      />
                      <JobCard job={job} status={status} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Flat list (non-status sort) */}
      {!grouped && processedJobs.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={processedJobs.every(j => selected.has(j.id))}
              onChange={() => toggleSelectAll(processedJobs)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              All ({processedJobs.length})
            </h3>
          </div>
          <div className="space-y-2">
            {processedJobs.map((job: Job) => (
              <div key={job.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(job.id)}
                  onChange={() => toggleSelect(job.id)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                />
                <JobCard job={job} status={job.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
