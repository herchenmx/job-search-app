'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { JobStatus } from '@/types'

const ALL_STATUSES: JobStatus[] = [
  'Review', 'Bookmarked', 'Interested', 'Reposted', 'Unfit',
  'Applied', 'Referred', 'Followed-Up',
  '1st Stage', '2nd Stage', '3rd Stage', '4th Stage',
  'Offered', 'Declined', 'Rejected', 'Signed', 'Closed'
]

export default function JobStatusUpdater({
  jobId,
  currentStatus,
  currentReason,
}: {
  jobId: string
  currentStatus: JobStatus
  currentReason: string | null
}) {
  const [status, setStatus] = useState<JobStatus>(currentStatus)
  const [reason, setReason] = useState(currentReason ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    await supabase
      .from('jobs')
      .update({ status, status_reason: reason || null })
      .eq('id', jobId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  const changed = status !== currentStatus || reason !== (currentReason ?? '')

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <select
        value={status}
        onChange={(e) => { setStatus(e.target.value as JobStatus); setSaved(false) }}
        className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {ALL_STATUSES.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <input
        type="text"
        value={reason}
        onChange={(e) => { setReason(e.target.value); setSaved(false) }}
        placeholder="Reason (optional)"
        className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-32"
      />

      <button
        onClick={handleSave}
        disabled={saving || !changed}
        className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Update'}
      </button>
    </div>
  )
}
