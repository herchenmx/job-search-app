'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function KeywordsSection({
  initialWanted,
  initialUnwanted,
}: {
  initialWanted: string[]
  initialUnwanted: string[]
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [wantedKeywords, setWantedKeywords] = useState(initialWanted.join(', '))
  const [unwantedKeywords, setUnwantedKeywords] = useState(initialUnwanted.join(', '))
  const [origWanted, setOrigWanted] = useState(initialWanted.join(', '))
  const [origUnwanted, setOrigUnwanted] = useState(initialUnwanted.join(', '))

  const supabase = createClient()

  const handleSave = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const wanted = wantedKeywords.split(',').map(k => k.trim()).filter(Boolean)
    const unwanted = unwantedKeywords.split(',').map(k => k.trim()).filter(Boolean)

    const { data: existing } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existing) {
      await supabase
        .from('user_profiles')
        .update({ wanted_keywords: wanted, unwanted_keywords: unwanted, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
    } else {
      await supabase
        .from('user_profiles')
        .insert({ user_id: user.id, wanted_keywords: wanted, unwanted_keywords: unwanted })
    }

    setOrigWanted(wantedKeywords)
    setOrigUnwanted(unwantedKeywords)
    setSaving(false)
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleCancel = () => {
    setWantedKeywords(origWanted)
    setUnwantedKeywords(origUnwanted)
    setEditing(false)
  }

  const hasKeywords = origWanted || origUnwanted

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Keywords</h3>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-green-600 font-medium">Saved</span>}
          {editing ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Wanted keywords</label>
            <input
              type="text"
              value={wantedKeywords}
              onChange={(e) => setWantedKeywords(e.target.value)}
              placeholder="Senior, Lead, Principal, AI, Automation…"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
            <p className="text-xs text-gray-400 mt-1">Comma-separated. Jobs with these keywords are prioritised.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unwanted keywords</label>
            <input
              type="text"
              value={unwantedKeywords}
              onChange={(e) => setUnwantedKeywords(e.target.value)}
              placeholder="Junior, Unpaid, Marketing Manager…"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
            <p className="text-xs text-gray-400 mt-1">Comma-separated. Scraped jobs matching these keywords are blocked from the database.</p>
          </div>
        </div>
      ) : hasKeywords ? (
        <div className="space-y-3">
          {origWanted && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Wanted</p>
              <div className="flex flex-wrap gap-1.5">
                {origWanted.split(',').map(k => k.trim()).filter(Boolean).map((kw) => (
                  <span key={kw} className="inline-block bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full border border-green-200">{kw}</span>
                ))}
              </div>
            </div>
          )}
          {origUnwanted && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Unwanted</p>
              <div className="flex flex-wrap gap-1.5">
                {origUnwanted.split(',').map(k => k.trim()).filter(Boolean).map((kw) => (
                  <span key={kw} className="inline-block bg-red-50 text-red-700 text-xs px-2 py-0.5 rounded-full border border-red-200">{kw}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">No keywords set. Wanted keywords prioritise jobs; unwanted keywords block them from being scraped.</p>
      )}
    </div>
  )
}
