'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ProfilePage() {
  const [cv, setCv] = useState('')
  const [cultureRubric, setCultureRubric] = useState('')
  const [roleRubric, setRoleRubric] = useState('')
  const [experienceRubric, setExperienceRubric] = useState('')
  const [wantedKeywords, setWantedKeywords] = useState('')
  const [unwantedKeywords, setUnwantedKeywords] = useState('')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [hasData, setHasData] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (data) {
        setProfileId(data.id)
        setCv(data.cv ?? '')
        setCultureRubric(data.culture_preferences_rubric ?? '')
        setRoleRubric(data.role_preferences_rubric ?? '')
        setExperienceRubric(data.experience_rubric ?? '')
        setWantedKeywords((data.wanted_keywords ?? []).join(', '))
        setUnwantedKeywords((data.unwanted_keywords ?? []).join(', '))
        
        // Check if user has any data saved
        const hasContent = data.cv || data.culture_preferences_rubric || data.role_preferences_rubric || 
                          data.experience_rubric || data.wanted_keywords?.length || data.unwanted_keywords?.length
        setHasData(!!hasContent)
      } else {
        // No profile exists yet, go straight to edit mode
        setEditing(true)
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const payload = {
      user_id: user.id,
      cv: cv || null,
      culture_preferences_rubric: cultureRubric || null,
      role_preferences_rubric: roleRubric || null,
      experience_rubric: experienceRubric || null,
      wanted_keywords: wantedKeywords
        .split(',')
        .map(k => k.trim())
        .filter(Boolean),
      unwanted_keywords: unwantedKeywords
        .split(',')
        .map(k => k.trim())
        .filter(Boolean),
    }

    if (profileId) {
      await supabase.from('user_profiles').update(payload).eq('id', profileId)
    } else {
      const { data } = await supabase.from('user_profiles').insert(payload).select().single()
      if (data) setProfileId(data.id)
    }

    setSaving(false)
    setSaved(true)
    setEditing(false)
    setHasData(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleCancel = () => {
    setEditing(false)
    // Reload from database to undo changes
    const reload = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).single()
      if (data) {
        setCv(data.cv ?? '')
        setCultureRubric(data.culture_preferences_rubric ?? '')
        setRoleRubric(data.role_preferences_rubric ?? '')
        setExperienceRubric(data.experience_rubric ?? '')
        setWantedKeywords((data.wanted_keywords ?? []).join(', '))
        setUnwantedKeywords((data.unwanted_keywords ?? []).join(', '))
      }
    }
    reload()
  }

  // Read-only view
  if (!editing && hasData) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Profile & CV</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              This data is used by the AI analysis workflows.
            </p>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Edit
          </button>
        </div>

        {cv && (
          <Section title="CV">
            <pre className="text-sm whitespace-pre-wrap text-gray-700">{cv}</pre>
          </Section>
        )}

        {cultureRubric && (
          <Section title="Culture Preferences Rubric">
            <pre className="text-sm whitespace-pre-wrap text-gray-700">{cultureRubric}</pre>
          </Section>
        )}

        {roleRubric && (
          <Section title="Role Preferences Rubric">
            <pre className="text-sm whitespace-pre-wrap text-gray-700">{roleRubric}</pre>
          </Section>
        )}

        {experienceRubric && (
          <Section title="Experience Rubric">
            <pre className="text-sm whitespace-pre-wrap text-gray-700">{experienceRubric}</pre>
          </Section>
        )}

        {(wantedKeywords || unwantedKeywords) && (
          <Section title="Keywords">
            {wantedKeywords && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Wanted</p>
                <p className="text-sm text-gray-700">{wantedKeywords}</p>
              </div>
            )}
            {unwantedKeywords && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Unwanted</p>
                <p className="text-sm text-gray-700">{unwantedKeywords}</p>
              </div>
            )}
          </Section>
        )}
      </div>
    )
  }

  // Edit mode
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Profile & CV</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          This data is used by the AI analysis workflows.
        </p>
      </div>

      <Section title="CV">
        <p className="text-xs text-gray-400 mb-3">
          Paste your CV in markdown format. PDF upload coming soon.
        </p>
        <textarea
          value={cv}
          onChange={(e) => setCv(e.target.value)}
          rows={12}
          placeholder="Paste your CV in markdown format here…"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </Section>

      <Section title="Culture Preferences Rubric">
        <textarea
          value={cultureRubric}
          onChange={(e) => setCultureRubric(e.target.value)}
          rows={8}
          placeholder="Paste your culture preferences rubric in markdown format…"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </Section>

      <Section title="Role Preferences Rubric">
        <textarea
          value={roleRubric}
          onChange={(e) => setRoleRubric(e.target.value)}
          rows={8}
          placeholder="Paste your role preferences rubric in markdown format…"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </Section>

      <Section title="Experience Rubric">
        <textarea
          value={experienceRubric}
          onChange={(e) => setExperienceRubric(e.target.value)}
          rows={8}
          placeholder="Paste your experience rubric in markdown format…"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </Section>

      <Section title="Keywords">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Wanted keywords
            </label>
            <input
              type="text"
              value={wantedKeywords}
              onChange={(e) => setWantedKeywords(e.target.value)}
              placeholder="Senior, Lead, Principal, AI, Automation…"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
            <p className="text-xs text-gray-400 mt-1">Comma-separated</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unwanted keywords
            </label>
            <input
              type="text"
              value={unwantedKeywords}
              onChange={(e) => setUnwantedKeywords(e.target.value)}
              placeholder="Junior, Unpaid, Marketing Manager…"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
            <p className="text-xs text-gray-400 mt-1">Comma-separated</p>
          </div>
        </div>
      </Section>

      <div className="flex items-center gap-3 pb-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save profile'}
        </button>
        {hasData && (
          <button
            onClick={handleCancel}
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
      {children}
    </div>
  )
}