'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type Category = 'bug' | 'feedback' | 'other'

const CATEGORY_LABELS: Record<Category, string> = {
  bug: 'Bug',
  feedback: 'Feedback',
  other: 'Other',
}

export default function BugReportWidget() {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<Category>('bug')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [open])

  const handleSubmit = async () => {
    if (!description.trim() || submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('You must be logged in to submit a report.')
        setSubmitting(false)
        return
      }

      const { error: insertError } = await supabase
        .from('bug_reports')
        .insert({
          user_id: user.id,
          description: description.trim(),
          category,
          page_url: window.location.pathname,
          user_agent: navigator.userAgent,
        })

      if (insertError) {
        setError(insertError.message)
        setSubmitting(false)
        return
      }

      setSubmitted(true)
      setDescription('')
      setCategory('bug')
      setTimeout(() => {
        setSubmitted(false)
        setOpen(false)
      }, 2000)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-5 z-50 bg-gray-900 text-white w-10 h-10 rounded-full shadow-lg hover:bg-gray-800 transition-colors flex items-center justify-center text-lg"
        title="Report a bug or give feedback"
      >
        {open ? '×' : '🐛'}
      </button>

      {/* Report modal */}
      {open && (
        <div className="fixed bottom-18 right-5 z-50 w-80 bg-white rounded-xl shadow-xl border border-gray-200 p-4">
          {submitted ? (
            <div className="text-center py-4">
              <p className="text-green-600 font-medium text-sm">Thanks for your report!</p>
              <p className="text-gray-400 text-xs mt-1">We&apos;ll look into it.</p>
            </div>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Report an issue</h3>

              <div className="space-y-3">
                {/* Category */}
                <div className="flex gap-2">
                  {(Object.keys(CATEGORY_LABELS) as Category[]).map(c => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                        category === c
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {CATEGORY_LABELS[c]}
                    </button>
                  ))}
                </div>

                {/* Description */}
                <textarea
                  ref={textareaRef}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What happened? What did you expect?"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />

                {/* Current page */}
                <p className="text-xs text-gray-400">
                  Page: {typeof window !== 'undefined' ? window.location.pathname : ''}
                </p>

                {error && <p className="text-xs text-red-600">{error}</p>}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={!description.trim() || submitting}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Submitting…' : 'Submit report'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
