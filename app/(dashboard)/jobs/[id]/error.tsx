'use client'

import Link from 'next/link'

export default function JobDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center max-w-md">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Failed to load job</h2>
        <p className="text-gray-500 text-sm mb-6">
          {error.message || 'Could not load the job details. It may have been deleted or you may not have access.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/jobs"
            className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Back to jobs
          </Link>
        </div>
      </div>
    </div>
  )
}
