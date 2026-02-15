'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type Stage = 'view' | 'upload' | 'review'

export default function CvPage() {
  const [stage, setStage] = useState<Stage>('upload')
  const [savedCv, setSavedCv] = useState<string | null>(null)
  const [parsedText, setParsedText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Load existing CV on mount
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('user_profiles')
        .select('id, cv')
        .eq('user_id', user.id)
        .single()

      if (data) {
        setProfileId(data.id)
        if (data.cv) {
          setSavedCv(data.cv)
          setStage('view')
        }
      }
    }
    load()
  }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)
    setFileName(file.name)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/profile/parse-cv', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to parse PDF')
        setUploading(false)
        return
      }

      setParsedText(data.text)
      setStage('review')
    } catch {
      setError('Something went wrong uploading the file')
    } finally {
      setUploading(false)
      // Reset file input so the same file can be re-selected
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    if (profileId) {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ cv: parsedText, updated_at: new Date().toISOString() })
        .eq('id', profileId)
      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }
    } else {
      const { data, error: insertError } = await supabase
        .from('user_profiles')
        .insert({ user_id: user.id, cv: parsedText })
        .select()
        .single()
      if (insertError) {
        setError(insertError.message)
        setSaving(false)
        return
      }
      if (data) setProfileId(data.id)
    }

    setSavedCv(parsedText)
    setSaving(false)
    setSaved(true)
    setStage('view')
    setTimeout(() => setSaved(false), 2000)
  }

  // View mode — show saved CV
  if (stage === 'view' && savedCv) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">CV</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Your parsed CV is used by the AI analysis workflows.
            </p>
          </div>
          <button
            onClick={() => { setParsedText(savedCv); setStage('review') }}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Edit CV
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <pre className="text-sm whitespace-pre-wrap text-gray-700 leading-relaxed">{savedCv}</pre>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Upload new CV</h3>
          <p className="text-xs text-gray-400 mb-3">
            Upload a new PDF to replace your current CV. You&apos;ll be able to review the parsed text before saving.
          </p>
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
            {uploading ? 'Parsing…' : 'Upload PDF'}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>

        {saved && (
          <p className="text-sm text-green-600 font-medium">CV saved successfully.</p>
        )}
      </div>
    )
  }

  // Review mode — show parsed text for editing before save
  if (stage === 'review') {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Review your CV</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {fileName
              ? `Parsed from ${fileName}. Review and edit the text below before saving.`
              : 'Edit the text below before saving.'}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <textarea
            value={parsedText}
            onChange={(e) => setParsedText(e.target.value)}
            rows={24}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex items-center gap-3 pb-8">
          <button
            onClick={handleSave}
            disabled={saving || !parsedText.trim()}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving…' : 'Save CV'}
          </button>
          <button
            onClick={() => {
              if (savedCv) {
                setStage('view')
              } else {
                setParsedText('')
                setFileName(null)
                setStage('upload')
              }
            }}
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // Upload mode — no CV yet, prompt to upload
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">CV</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Upload your CV as a PDF. It will be parsed into text for the AI analysis workflows.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <p className="text-4xl mb-3">📄</p>
        <h3 className="text-lg font-medium text-gray-900 mb-1">No CV uploaded yet</h3>
        <p className="text-gray-500 text-sm mb-6">
          Upload a PDF file to get started. The text will be extracted and you can review it before saving.
        </p>

        <label className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
          {uploading ? 'Parsing PDF…' : 'Upload CV (PDF)'}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>

        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
      </div>
    </div>
  )
}
