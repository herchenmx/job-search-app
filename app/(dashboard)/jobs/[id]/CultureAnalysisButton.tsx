'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CultureAnalysisButton({ companyId }: { companyId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleAnalyse = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/jobs/analyse-culture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Analysis failed')
        return
      }

      router.refresh()
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleAnalyse}
        disabled={loading}
        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
      >
        {loading ? 'Analysing… (this may take a minute)' : 'Run culture analysis'}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
