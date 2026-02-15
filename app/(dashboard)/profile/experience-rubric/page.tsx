'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import MarkdownRenderer from '@/components/MarkdownRenderer'

type Mode = 'view' | 'edit'

export default function ExperienceRubricPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<Mode | null>(null)
  const [savedRubric, setSavedRubric] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [origRubric, setOrigRubric] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [showSaveWarning, setShowSaveWarning] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('experience_rubric')
        .eq('user_id', user.id)
        .single()

      const rubric = profile?.experience_rubric ?? null
      setSavedRubric(rubric)
      setOrigRubric(rubric)
      setMode(rubric ? 'view' : 'edit')
      setEditValue(rubric ?? '')
    }
    load()
  }, [])

  function handleSaveClick() {
    if (editValue !== (origRubric ?? '')) {
      setShowSaveWarning(true)
    } else {
      saveRubric()
    }
  }

  async function saveRubric() {
    setShowSaveWarning(false)
    setSaving(true)
    setSaveMsg('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      const { data: existing } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (existing) {
        await supabase
          .from('user_profiles')
          .update({ experience_rubric: editValue, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
      } else {
        await supabase
          .from('user_profiles')
          .insert({ user_id: user.id, experience_rubric: editValue })
      }

      if (editValue !== (origRubric ?? '')) {
        await supabase
          .from('jobs')
          .update({ needs_experience_match_reanalysis: false, experience_match_rate: null, experience_match_insights: null })
          .eq('user_id', user.id)
      }

      setSavedRubric(editValue)
      setOrigRubric(editValue)
      setSaveMsg('Saved!')
      setTimeout(() => { setMode('view'); setSaveMsg('') }, 1200)
    } catch {
      setSaveMsg('Error saving. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (mode === null) return null

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.push('/profile')} className="text-gray-400 hover:text-gray-600 text-sm">← Profile</button>
        <h1 className="text-2xl font-bold text-gray-900">Experience Rubric</h1>
      </div>

      {/* View mode */}
      {mode === 'view' && savedRubric && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <MarkdownRenderer content={savedRubric} />
          </div>
          <button
            onClick={() => { setEditValue(savedRubric); setMode('edit') }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Edit rubric
          </button>
        </div>
      )}

      {/* Edit mode */}
      {mode === 'edit' && (
        <div className="space-y-4">
          {!savedRubric && (
            <p className="text-sm text-gray-500">Paste or type your experience rubric in markdown format.</p>
          )}
          <textarea
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            rows={20}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            placeholder="## Experience Rubric&#10;&#10;### Must-Haves&#10;- 5+ years of product management&#10;- ..."
          />
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveClick}
              disabled={!editValue.trim() || saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {savedRubric && (
              <button onClick={() => setMode('view')} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
            )}
            {saveMsg && <span className="text-sm text-green-600">{saveMsg}</span>}
          </div>
        </div>
      )}

      {showSaveWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Reset existing ratings?</h3>
            <p className="text-sm text-gray-600">Changing this rubric will reset all your existing experience match ratings. Re-running these analyses will incur additional API costs.</p>
            <div className="flex flex-col gap-2 pt-2">
              <button onClick={saveRubric} className="w-full px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">I understand, save and reset ratings</button>
              <button onClick={() => setShowSaveWarning(false)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">Cancel, don&apos;t change this</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
