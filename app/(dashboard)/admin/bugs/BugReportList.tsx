'use client'

import { useState, useMemo } from 'react'
import { BugReport, BugReportStatus, BugReportCategory } from '@/types'

const STATUS_COLOURS: Record<BugReportStatus, string> = {
  open: 'bg-red-100 text-red-700',
  acknowledged: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-green-100 text-green-700',
}

const STATUS_OPTIONS: BugReportStatus[] = ['open', 'acknowledged', 'resolved']

const CATEGORY_LABELS: Record<BugReportCategory, string> = {
  bug: '🐛 Bug',
  feedback: '💬 Feedback',
  other: '📝 Other',
}

const NEXT_STATUS: Record<BugReportStatus, BugReportStatus> = {
  open: 'acknowledged',
  acknowledged: 'resolved',
  resolved: 'open',
}

export default function BugReportList({
  initialReports,
}: {
  initialReports: BugReport[]
}) {
  const [reports, setReports] = useState<BugReport[]>(initialReports)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterCategory, setFilterCategory] = useState<string>('')

  const filtered = useMemo(() => {
    let result = [...reports]
    if (filterStatus) result = result.filter(r => r.status === filterStatus)
    if (filterCategory) result = result.filter(r => r.category === filterCategory)
    return result
  }, [reports, filterStatus, filterCategory])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const s of STATUS_OPTIONS) c[s] = reports.filter(r => r.status === s).length
    return c
  }, [reports])

  const handleStatusChange = async (report: BugReport) => {
    const newStatus = NEXT_STATUS[report.status]
    // Optimistic update
    setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: newStatus } : r))
    try {
      await fetch('/api/admin/bugs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: report.id, status: newStatus }),
      })
    } catch {
      // Revert on failure
      setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: report.status } : r))
    }
  }

  return (
    <div>
      {/* Status summary */}
      <div className="flex gap-3 mb-4">
        {STATUS_OPTIONS.map(s => (
          <div
            key={s}
            className={`px-3 py-2 rounded-lg text-sm font-medium ${STATUS_COLOURS[s]} cursor-pointer hover:opacity-80 transition-opacity ${
              filterStatus === s ? 'ring-2 ring-offset-1 ring-gray-400' : ''
            }`}
            onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
          >
            {counts[s] || 0} {s}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-sm text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s} ({counts[s] || 0})</option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="text-sm text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All categories</option>
          {(['bug', 'feedback', 'other'] as BugReportCategory[]).map(c => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        {(filterStatus || filterCategory) && (
          <span className="text-xs text-gray-400">
            Showing {filtered.length} of {reports.length}
          </span>
        )}
      </div>

      {/* Empty state */}
      {reports.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-4xl mb-3">🐛</p>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No bug reports yet</h3>
          <p className="text-gray-500 text-sm">
            Reports submitted by users will appear here.
          </p>
        </div>
      )}

      {/* Reports list */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map(report => (
            <div
              key={report.id}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs text-gray-500">
                      {CATEGORY_LABELS[report.category]}
                    </span>
                    <button
                      onClick={() => handleStatusChange(report)}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer hover:opacity-80 transition-opacity ${STATUS_COLOURS[report.status]}`}
                      title={`Click to change to "${NEXT_STATUS[report.status]}"`}
                    >
                      {report.status}
                    </button>
                  </div>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">
                    {report.description}
                  </p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {report.page_url && (
                      <span className="text-xs text-gray-400">
                        Page: {report.page_url}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {new Date(report.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="text-xs font-mono text-gray-300">
                      {report.user_id.slice(0, 8)}…
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No filter results */}
      {reports.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 text-sm">No reports match your filters.</p>
        </div>
      )}
    </div>
  )
}
