'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type FieldKey = 'culture' | 'role' | 'experience' | 'keywords'

export default function ProfilePage() {
  const [cultureRubric, setCultureRubric] = useState('')
  const [roleRubric, setRoleRubric] = useState('')
  const [experienceRubric, setExperienceRubric] = useState('')
  const [wantedKeywords, setWantedKeywords] = useState('')
  const [unwantedKeywords, setUnwantedKeywords] = useState('')

  // Track which field is currently being edited (only one at a time, or null)
  const [editingField, setEditingField] = useState<FieldKey | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedField, setSavedField] = useState<FieldKey | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Stash original values so we can cancel edits
  const [origCulture, setOrigCulture] = useState('')
  const [origRole, setOrigRole] = useState('')
  const [origExperience, setOrigExperience] = useState('')
  const [origWanted, setOrigWanted] = useState('')
  const [origUnwanted, setOrigUnwanted] = useState('')

  const supabase = createClient()
  const router = useRouter()

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
        const c = data.culture_preferences_rubric ?? ''
        const r = data.role_preferences_rubric ?? ''
        const e = data.experience_rubric ?? ''
        const w = (data.wanted_keywords ?? []).join(', ')
        const u = (data.unwanted_keywords ?? []).join(', ')
        setCultureRubric(c)
        setRoleRubric(r)
        setExperienceRubric(e)
        setWantedKeywords(w)
        setUnwantedKeywords(u)
        setOrigCulture(c)
        setOrigRole(r)
        setOrigExperience(e)
        setOrigWanted(w)
        setOrigUnwanted(u)
      }
      setLoaded(true)
    }
    load()
  }, [])

  const startEditing = (field: FieldKey) => {
    // Stash current values before editing
    setOrigCulture(cultureRubric)
    setOrigRole(roleRubric)
    setOrigExperience(experienceRubric)
    setOrigWanted(wantedKeywords)
    setOrigUnwanted(unwantedKeywords)
    setEditingField(field)
  }

  const cancelEditing = () => {
    // Restore original values for the field being edited
    setCultureRubric(origCulture)
    setRoleRubric(origRole)
    setExperienceRubric(origExperience)
    setWantedKeywords(origWanted)
    setUnwantedKeywords(origUnwanted)
    setEditingField(null)
  }

  const handleSave = async (field: FieldKey) => {
    setSaving(true)
    setSavedField(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const fullPayload = {
      user_id: user.id,
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
      await supabase.from('user_profiles').update(fullPayload).eq('id', profileId)
    } else {
      const { data } = await supabase.from('user_profiles').insert(fullPayload).select().single()
      if (data) setProfileId(data.id)
    }

    // If rubrics changed, reset reanalysis flags
    if (field === 'role' || field === 'experience') {
      await supabase
        .from('jobs')
        .update({ needs_role_match_reanalysis: false, job_match_rate: null, job_match_insights: null })
        .eq('user_id', user.id)
        .eq('needs_role_match_reanalysis', true)

      await supabase
        .from('jobs')
        .update({ needs_experience_match_reanalysis: false, experience_match_rate: null, experience_match_insights: null })
        .eq('user_id', user.id)
        .eq('needs_experience_match_reanalysis', true)
    }

    // Update stashed originals to the new saved values
    setOrigCulture(cultureRubric)
    setOrigRole(roleRubric)
    setOrigExperience(experienceRubric)
    setOrigWanted(wantedKeywords)
    setOrigUnwanted(unwantedKeywords)

    setSaving(false)
    setEditingField(null)
    setSavedField(field)
    setTimeout(() => setSavedField(null), 2000)
  }

  if (!loaded) return null

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Profile</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          This data is used by the AI analysis workflows.
        </p>
      </div>

      {/* Culture Preferences Rubric */}
      <Section
        title="Culture Preferences Rubric"
        editing={editingField === 'culture'}
        saving={saving && editingField === 'culture'}
        saved={savedField === 'culture'}
        onEdit={() => startEditing('culture')}
        onSave={() => handleSave('culture')}
        onCancel={cancelEditing}
        disabled={editingField !== null && editingField !== 'culture'}
        extraActions={
          <button
            onClick={() => router.push('/profile/culture-rubric')}
            className="text-xs text-blue-600 hover:underline"
          >
            {cultureRubric ? 'Edit with AI' : '+ Create with AI'}
          </button>
        }
      >
        {editingField === 'culture' ? (
          <textarea
            value={cultureRubric}
            onChange={(e) => setCultureRubric(e.target.value)}
            rows={8}
            placeholder="Paste your culture preferences rubric in markdown format…"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        ) : cultureRubric ? (
          <pre className="text-sm whitespace-pre-wrap text-gray-700">{cultureRubric}</pre>
        ) : (
          <p className="text-sm text-gray-400 italic">No culture preferences rubric set.</p>
        )}
      </Section>

      {/* Role Preferences Rubric */}
      <Section
        title="Role Preferences Rubric"
        editing={editingField === 'role'}
        saving={saving && editingField === 'role'}
        saved={savedField === 'role'}
        onEdit={() => startEditing('role')}
        onSave={() => handleSave('role')}
        onCancel={cancelEditing}
        disabled={editingField !== null && editingField !== 'role'}
        extraActions={
          <button
            onClick={() => router.push('/profile/role-rubric')}
            className="text-xs text-blue-600 hover:underline"
          >
            {roleRubric ? 'Edit with AI' : '+ Create with AI'}
          </button>
        }
      >
        {editingField === 'role' ? (
          <textarea
            value={roleRubric}
            onChange={(e) => setRoleRubric(e.target.value)}
            rows={8}
            placeholder="Paste your role preferences rubric in markdown format…"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        ) : roleRubric ? (
          <pre className="text-sm whitespace-pre-wrap text-gray-700">{roleRubric}</pre>
        ) : (
          <p className="text-sm text-gray-400 italic">No role preferences rubric set.</p>
        )}
      </Section>

      {/* Experience Rubric */}
      <Section
        title="Experience Rubric"
        editing={editingField === 'experience'}
        saving={saving && editingField === 'experience'}
        saved={savedField === 'experience'}
        onEdit={() => startEditing('experience')}
        onSave={() => handleSave('experience')}
        onCancel={cancelEditing}
        disabled={editingField !== null && editingField !== 'experience'}
      >
        {editingField === 'experience' ? (
          <textarea
            value={experienceRubric}
            onChange={(e) => setExperienceRubric(e.target.value)}
            rows={8}
            placeholder="Paste your experience rubric in markdown format…"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        ) : experienceRubric ? (
          <pre className="text-sm whitespace-pre-wrap text-gray-700">{experienceRubric}</pre>
        ) : (
          <p className="text-sm text-gray-400 italic">No experience rubric set.</p>
        )}
      </Section>

      {/* Keywords */}
      <Section
        title="Keywords"
        editing={editingField === 'keywords'}
        saving={saving && editingField === 'keywords'}
        saved={savedField === 'keywords'}
        onEdit={() => startEditing('keywords')}
        onSave={() => handleSave('keywords')}
        onCancel={cancelEditing}
        disabled={editingField !== null && editingField !== 'keywords'}
      >
        {editingField === 'keywords' ? (
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
        ) : (wantedKeywords || unwantedKeywords) ? (
          <div className="space-y-3">
            {wantedKeywords && (
              <div>
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
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">No keywords set.</p>
        )}
      </Section>
    </div>
  )
}

function Section({
  title,
  editing,
  saving,
  saved,
  onEdit,
  onSave,
  onCancel,
  disabled,
  extraActions,
  children,
}: {
  title: string
  editing: boolean
  saving: boolean
  saved: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  disabled: boolean
  extraActions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center gap-3">
          {extraActions}
          {editing ? (
            <div className="flex items-center gap-2">
              <button
                onClick={onSave}
                disabled={saving}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={onCancel}
                disabled={saving}
                className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              {saved && (
                <span className="text-xs text-green-600 font-medium">Saved</span>
              )}
              <button
                onClick={onEdit}
                disabled={disabled}
                className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Edit
              </button>
            </>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}
