'use client'

import { useState, useMemo } from 'react'
import { ApiCallLog } from '@/types'

interface Props {
  initialLogs: ApiCallLog[]
}

const SERVICE_COLORS: Record<string, string> = {
  brightdata: 'bg-orange-100 text-orange-800',
  deepseek: 'bg-blue-100 text-blue-800',
  anthropic: 'bg-purple-100 text-purple-800',
  assemblyai: 'bg-green-100 text-green-800',
  github: 'bg-gray-100 text-gray-800',
}

type TimeRange = '24h' | '7d' | '30d'

export default function ApiCallDashboard({ initialLogs }: Props) {
  const [logs, setLogs] = useState(initialLogs)
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')
  const [filterService, setFilterService] = useState<string>('all')
  const [loading, setLoading] = useState(false)

  const daysMap: Record<TimeRange, number> = { '24h': 1, '7d': 7, '30d': 30 }

  async function fetchLogs(range: TimeRange) {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/api-logs?days=${daysMap[range]}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs)
      }
    } finally {
      setLoading(false)
    }
  }

  function handleTimeChange(range: TimeRange) {
    setTimeRange(range)
    fetchLogs(range)
  }

  // Filter logs by service
  const filteredLogs = useMemo(() => {
    if (filterService === 'all') return logs
    return logs.filter(l => l.service === filterService)
  }, [logs, filterService])

  // Compute stats per service
  const stats = useMemo(() => {
    const map: Record<string, {
      total: number
      errors: number
      totalDuration: number
      durationCount: number
    }> = {}

    for (const log of logs) {
      if (!map[log.service]) {
        map[log.service] = { total: 0, errors: 0, totalDuration: 0, durationCount: 0 }
      }
      const s = map[log.service]!
      s.total++
      if (log.error || (log.status_code && log.status_code >= 400)) {
        s.errors++
      }
      if (log.duration_ms != null) {
        s.totalDuration += log.duration_ms
        s.durationCount++
      }
    }

    return Object.entries(map)
      .map(([service, s]) => ({
        service,
        total: s.total,
        errors: s.errors,
        errorRate: s.total > 0 ? Math.round((s.errors / s.total) * 100) : 0,
        avgDuration: s.durationCount > 0 ? Math.round(s.totalDuration / s.durationCount) : null,
      }))
      .sort((a, b) => b.total - a.total)
  }, [logs])

  // All unique services
  const services = useMemo(() => [...new Set(logs.map(l => l.service))].sort(), [logs])

  // Totals
  const totalCalls = stats.reduce((sum, s) => sum + s.total, 0)
  const totalErrors = stats.reduce((sum, s) => sum + s.errors, 0)
  const overallErrorRate = totalCalls > 0 ? Math.round((totalErrors / totalCalls) * 100) : 0

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  function formatDuration(ms: number | null) {
    if (ms == null) return '—'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  function statusColor(code: number | null, error: string | null) {
    if (error) return 'text-red-600'
    if (!code) return 'text-gray-400'
    if (code >= 200 && code < 300) return 'text-green-600'
    if (code >= 400) return 'text-red-600'
    return 'text-yellow-600'
  }

  return (
    <div className="space-y-6">
      {/* Time range selector */}
      <div className="flex items-center gap-2">
        {(['24h', '7d', '30d'] as TimeRange[]).map(range => (
          <button
            key={range}
            onClick={() => handleTimeChange(range)}
            disabled={loading}
            className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
              timeRange === range
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } disabled:opacity-50`}
          >
            {range}
          </button>
        ))}
        {loading && <span className="text-sm text-gray-400 ml-2">Loading...</span>}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Total Calls</p>
          <p className="text-2xl font-bold text-gray-900">{totalCalls}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Errors</p>
          <p className="text-2xl font-bold text-red-600">{totalErrors}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Error Rate</p>
          <p className={`text-2xl font-bold ${overallErrorRate > 10 ? 'text-red-600' : overallErrorRate > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
            {overallErrorRate}%
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Services</p>
          <p className="text-2xl font-bold text-gray-900">{services.length}</p>
        </div>
      </div>

      {/* Per-service breakdown */}
      {stats.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">By Service</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {stats.map(s => (
              <div key={s.service} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${SERVICE_COLORS[s.service] || 'bg-gray-100 text-gray-700'}`}>
                    {s.service}
                  </span>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-gray-600">
                    <span className="font-medium">{s.total}</span> calls
                  </span>
                  <span className={s.errors > 0 ? 'text-red-600' : 'text-gray-400'}>
                    <span className="font-medium">{s.errors}</span> errors ({s.errorRate}%)
                  </span>
                  <span className="text-gray-500 w-20 text-right">
                    avg {formatDuration(s.avgDuration)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            Recent Calls {filteredLogs.length !== logs.length && `(${filteredLogs.length} of ${logs.length})`}
          </h3>
          <select
            value={filterService}
            onChange={e => setFilterService(e.target.value)}
            className="text-sm border border-gray-200 rounded px-2 py-1 text-gray-600"
          >
            <option value="all">All services</option>
            {services.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            No API calls recorded in this time range.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider bg-gray-50">
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Service</th>
                  <th className="px-4 py-2">Endpoint</th>
                  <th className="px-4 py-2">Method</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Duration</th>
                  <th className="px-4 py-2">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${SERVICE_COLORS[log.service] || 'bg-gray-100 text-gray-700'}`}>
                        {log.service}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-700 font-mono text-xs max-w-[200px] truncate">
                      {log.endpoint}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {log.method}
                    </td>
                    <td className={`px-4 py-2 font-medium ${statusColor(log.status_code, log.error)}`}>
                      {log.status_code || '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-500 whitespace-nowrap">
                      {formatDuration(log.duration_ms)}
                    </td>
                    <td className="px-4 py-2 text-red-600 text-xs max-w-[200px] truncate" title={log.error || ''}>
                      {log.error || ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
