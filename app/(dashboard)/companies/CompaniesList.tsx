'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Company } from '@/types'

type CompanyWithJobs = Company & { jobs: { count: number }[] }
type SortField = 'name' | 'rating'
type SortDir = 'asc' | 'desc'

function CompanyCard({ company }: { company: CompanyWithJobs }) {
  const jobCount = company.jobs?.[0]?.count ?? 0
  const hasScore = company.cultural_match_rate !== null && company.cultural_match_rate !== undefined
  const score = hasScore ? company.cultural_match_rate : null

  return (
    <Link
      href={`/companies/${company.id}`}
      className="flex-1 block bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all"
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
}

export default function CompaniesList({
  companies,
}: {
  companies: CompanyWithJobs[]
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [sortBy, setSortBy] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [search, setSearch] = useState('')
  const router = useRouter()

  const processedCompanies = useMemo(() => {
    let result = [...companies]

    // 1. Free-text search
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      result = result.filter(c => c.name.toLowerCase().includes(q))
    }

    // 2. Sort
    const dir = sortDir === 'asc' ? 1 : -1
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name) * dir
        case 'rating': {
          const aRate = a.cultural_match_rate ?? -1
          const bRate = b.cultural_match_rate ?? -1
          return (aRate - bRate) * dir
        }
        default:
          return 0
      }
    })

    return result
  }, [companies, search, sortBy, sortDir])

  const toggleSelect = (companyId: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(companyId)) next.delete(companyId)
      else next.add(companyId)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelected(prev => {
      const allSelected = processedCompanies.every(c => prev.has(c.id))
      if (allSelected) return new Set<string>()
      return new Set(processedCompanies.map(c => c.id))
    })
  }

  const handleBulkDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch('/api/companies/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyIds: Array.from(selected) }),
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

  const isFiltered = search.trim()
  const allSelected = processedCompanies.length > 0 && processedCompanies.every(c => selected.has(c.id))

  return (
    <div>
      {/* Toolbar: search, sort */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search companies…"
          className="text-sm text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
        />

        {/* Sort field */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortField)}
          className="text-sm text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="name">Sort by name</option>
          <option value="rating">Sort by rating</option>
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
            Showing {processedCompanies.length} of {companies.length}
          </span>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <span className="text-sm text-red-800 font-medium">
            {selected.size} compan{selected.size > 1 ? 'ies' : 'y'} selected
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

      {/* No results */}
      {processedCompanies.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 text-sm">No companies match your search.</p>
        </div>
      )}

      {/* Select all */}
      {processedCompanies.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            All ({processedCompanies.length})
          </span>
        </div>
      )}

      {/* Company grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {processedCompanies.map((company) => (
          <div key={company.id} className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={selected.has(company.id)}
              onChange={() => toggleSelect(company.id)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0 mt-5"
            />
            <CompanyCard company={company} />
          </div>
        ))}
      </div>
    </div>
  )
}
