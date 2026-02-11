'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { JobSearch } from '@/types'

const EXPERIENCE_LEVELS = ['Internship', 'Entry level', 'Associate', 'Mid-Senior level', 'Director', 'Executive']
const WORK_MODELS = ['On-site', 'Remote', 'Hybrid']
const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Volunteer', 'Internship']

export default function SearchForm({ search }: { search?: JobSearch }) {
  const isEdit = !!search

  const [label, setLabel] = useState(search?.label ?? '')
  const [keyword, setKeyword] = useState(search?.keyword ?? '')
  const [location, setLocation] = useState(search?.location ?? '')
  const [experienceLevels, setExperienceLevels] = useState<string[]>(search?.experience_level ?? [])
  const [workModels, setWorkModels] = useState<string[]>(search?.work_model ?? [])
  const [jobTypes, setJobTypes] = useState<string[]>(search?.job_type ?? [])
  const [isActive, setIsActive] = useState(search?.is_active ?? true)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  const toggleMultiSelect = (value: string, current: string[], setter: (v: string[]) => void) => {
    if (current.includes(value)) {
      setter(current.filter(v => v !== value))
    } else {
      setter([...current, value])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setSaving(false); return }

    const payload = {
      user_id: user.id,
      label: label.trim(),
      keyword: keyword.trim(),
      location: location.trim(),
      experience_level: experienceLevels,
      work_model: workModels,
      job_type: jobTypes,
      is_active: isActive,
    }

    if (isEdit) {
      const { error: updateError } = await supabase
        .from('job_searches')
        .update(payload)
        .eq('id', search.id)

      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }
    } else {
      const { error: insertError } = await supabase
        .from('job_searches')
        .insert(payload)

      if (insertError) {
        setError(insertError.message)
        setSaving(false)
        return
      }
    }

    router.push('/searches')
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/searches" className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">
        ← Back to searches
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">
          {isEdit ? 'Edit search' : 'New search'}
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Configure your LinkedIn job search parameters.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Label <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              placeholder="e.g. Senior PM Berlin"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Keyword <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              required
              placeholder="e.g. Product Manager"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
              placeholder="e.g. Berlin, Germany"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Experience level
            </label>
            <div className="flex flex-wrap gap-2">
              {EXPERIENCE_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => toggleMultiSelect(level, experienceLevels, setExperienceLevels)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    experienceLevels.includes(level)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Work model
            </label>
            <div className="flex flex-wrap gap-2">
              {WORK_MODELS.map((model) => (
                <button
                  key={model}
                  type="button"
                  onClick={() => toggleMultiSelect(model, workModels, setWorkModels)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    workModels.includes(model)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {model}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Job type
            </label>
            <div className="flex flex-wrap gap-2">
              {JOB_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleMultiSelect(type, jobTypes, setJobTypes)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    jobTypes.includes(type)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="is_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">
              Active (search will run automatically)
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving…' : isEdit ? 'Update search' : 'Create search'}
            </button>
            <Link
              href="/searches"
              className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}