'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { InterviewTranscript, InterviewAnalysis } from '@/types'

interface Recording {
  id: string
  interview_number: number
  file_name: string
  uploaded_at: string
}

export default function InterviewSection({
  jobId,
  transcripts,
  analyses,
  recordings,
  maxInterview,
}: {
  jobId: string
  transcripts: InterviewTranscript[]
  analyses: InterviewAnalysis[]
  recordings: Recording[]
  maxInterview: number
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(maxInterview > 0 ? maxInterview : 1)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const interviewNumbers = Array.from(
    { length: Math.max(maxInterview, 1) },
    (_, i) => i + 1
  )

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadError(null)

    try {
      const filePath = `${jobId}/interview-${activeTab}-${Date.now()}-${file.name}`

      const { error: storageError } = await supabase.storage
        .from('interview-recordings')
        .upload(filePath, file)

      if (storageError) throw new Error(storageError.message)

      const { data: { user } } = await supabase.auth.getUser()

      await supabase.from('interview_recordings').insert({
        job_id: jobId,
        user_id: user!.id,
        interview_number: activeTab,
        file_path: filePath,
        file_name: file.name,
      })

      router.refresh()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const transcript = transcripts.find(t => t.interview_number === activeTab)
  const analysis = analyses.find(a => a.interview_number === activeTab)
  const recording = recordings.find(r => r.interview_number === activeTab)

  return (
    <div>
      {/* Interview tabs */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {interviewNumbers.map(n => (
          <button
            key={n}
            onClick={() => setActiveTab(n)}
            className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === n
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Interview {n}
          </button>
        ))}
        <button
          onClick={() => setActiveTab(interviewNumbers.length + 1)}
          className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
        >
          + Add interview
        </button>
      </div>

      {/* Recording upload */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        {recording ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">🎙 {recording.file_name}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Uploaded {new Date(recording.uploaded_at).toLocaleDateString()}
                {transcript && ' · Transcribed ✓'}
              </p>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500 mb-2">No recording uploaded for Interview {activeTab}</p>
            <label className={`inline-block text-sm px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
              uploading
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}>
              {uploading ? 'Uploading…' : '↑ Upload recording'}
              <input
                ref={fileRef}
                type="file"
                accept="audio/*,video/*"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
            {uploadError && (
              <p className="text-xs text-red-500 mt-1">{uploadError}</p>
            )}
          </div>
        )}
      </div>

      {/* Transcript */}
      <div className="mb-4">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Transcript
        </h4>
        {transcript ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto bg-gray-50 rounded-lg p-3">
            {transcript.transcript_text}
          </p>
        ) : (
          <p className="text-sm text-gray-400 italic">
            {recording ? 'Transcription pending…' : 'Upload a recording to generate a transcript'}
          </p>
        )}
      </div>

      {/* Analysis */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Analysis
        </h4>
        {analysis ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto bg-gray-50 rounded-lg p-3">
            {analysis.analysis_text}
          </p>
        ) : (
          <p className="text-sm text-gray-400 italic">
            {transcript ? 'Analysis pending…' : 'No analysis yet'}
          </p>
        )}
      </div>
    </div>
  )
}
