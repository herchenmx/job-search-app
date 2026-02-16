'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SearchToggle({ searchId, isActive }: { searchId: string; isActive: boolean }) {
  const [active, setActive] = useState(isActive)
  const supabase = createClient()

  const handleToggle = async () => {
    const newState = !active
    // Optimistic: toggle immediately
    setActive(newState)
    await supabase.from('job_searches').update({ is_active: newState }).eq('id', searchId)
  }

  return (
    <button
      onClick={handleToggle}
      className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${
        active
          ? 'bg-green-100 text-green-700 hover:bg-green-200'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </button>
  )
}