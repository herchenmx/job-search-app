'use client'

import { useState, useEffect, useRef } from 'react'
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
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)

  // CV upload confirmation flow
  const [pendingCv, setPendingCv] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
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
    setTimeout(() => setSaved(false), 2000)
  }

  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/parse-cv', {
        method: 'POST',
        body: formData,
      })

      const json = await res.json()

      if (!res.ok) throw new Error(json.error ?? 'Upload failed')

      // Show confirmation modal instead of directly saving
      setPendingCv(json.markdown)
      setUploadedFile(file)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleConfirmCv = () => {
    if (pendingCv) {
      setCv(pendingCv)
      setPendingCv(null)
      setUploadedFile(null)
    }
  }

  const handleCancelCv = () => {
    setPendingCv(null)
    setUploadedFile(null)
  }

  return (
    <>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Profile & CV</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            This data is used by the AI analysis workflows.
          </p>
        </div>

        {/* CV */}
        <Section title="CV">
          <div className="mb-3 flex items-center gap-3">
            <label className={`inline-block text-sm px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
              uploading
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}>
              {uploading ? 'Parsing PDF…' : '↑ Upload PDF'}
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                onChange={handleCvUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
            <span className="text-xs text-gray-400">
              Upload your CV as a PDF — you'll review before saving.
            </span>
          </div>
          {uploadError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{uploadError}</p>
          )}
          <textarea
            value={cv}
            onChange={(e) => setCv(e.target.value)}
            rows={12}
            placeholder="Your CV in markdown format will appear here after upload, or paste it manually."
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </Section>

        {/* Culture rubric */}
        <Section title="Culture Preferences Rubric">
          <textarea
            value={cultureRubric}
            onChange={(e) => setCultureRubric(e.target.value)}
            rows={8}
            placeholder="Paste your culture preferences rubric in markdown format…"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </Section>

        {/* Role rubric */}
        <Section title="Role Preferences Rubric">
          <textarea
            value={roleRubric}
            onChange={(e) => setRoleRubric(e.target.value)}
            rows={8}
            placeholder="Paste your role preferences rubric in markdown format…"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </Section>

        {/* Experience rubric */}
        <Section title="Experience Rubric">
          <textarea
            value={experienceRubric}
            onChange={(e) => setExperienceRubric(e.target.value)}
            rows={8}
            placeholder="Paste your experience rubric in markdown format…"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </Section>

        {/* Keywords */}
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
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">Comma-separated</p>
            </div>
          </div>
        </Section>

        {/* Save button */}
        <div className="flex items-center gap-3 pb-8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save profile'}
          </button>
        </div>
      </div>

      {/* CV confirmation modal */}
      {pendingCv && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Review Parsed CV</h3>
              <p className="text-sm text-gray-500 mt-1">
                File: {uploadedFile?.name} • {Math.round((uploadedFile?.size ?? 0) / 1024)} KB
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <pre className="text-sm font-mono whitespace-pre-wrap text-gray-700 bg-gray-50 rounded-lg p-4">
{pendingCv}
              </pre>
            </div>
            <div className="p-5 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={handleCancelCv}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCv}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Looks good, save it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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