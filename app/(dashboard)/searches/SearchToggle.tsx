'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SearchToggle({ searchId, isActive }: { searchId: string; isActive: boolean }) {
  const [active, setActive] = useState(isActive)
  const [updating, setUpdating] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const handleToggle = async () => {
    setUpdating(true)
    const newState = !active
    await supabase.from('job_searches').update({ is_active: newState }).eq('id', searchId)
    setActive(newState)
    setUpdating(false)
    router.refresh()
  }

  return (
    <button
      onClick={handleToggle}
      disabled={updating}
      className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${
        active
          ? 'bg-green-100 text-green-700 hover:bg-green-200'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {updating ? '...' : active ? 'Active' : 'Inactive'}
    </button>
  )
}