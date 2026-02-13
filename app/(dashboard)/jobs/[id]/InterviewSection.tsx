'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { InterviewTranscript, InterviewAnalysis } from '@/types'

interface Recording {
  id: string
  interview_number: number
  file_name: string
  uploaded_at: string
  assemblyai_id: string | null
  transcription_status: string
}

type ProcessingState = 'idle' | 'uploading' | 'submitting' | 'transcribing' | 'analysing' | 'done' | 'error'

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
  const [activeTab, setActiveTab] = useState(maxInterview > 0 ? maxInterview : 1)
  const [processing, setProcessing] = useState<ProcessingState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [localAnalysis, setLocalAnalysis] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const interviewNumbers = Array.from({ length: Math.max(maxInterview, 1) }, (_, i) => i + 1)

  const transcript = transcripts.find(t => t.interview_number === activeTab)
  const analysis = analyses.find(a => a.interview_number === activeTab)
  const recording = recordings.find(r => r.interview_number === activeTab)

  // Resume polling if recording exists but transcript doesn't (e.g. page was refreshed mid-transcription)
  useEffect(() => {
    if (
      recording &&
      !transcript &&
      recording.assemblyai_id &&
      (recording.transcription_status === 'submitted' || recording.transcription_status === 'processing')
    ) {
      startPolling(recording.id, recording.assemblyai_id)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [activeTab])

  const startPolling = useCallback((recordingId: string, assemblyaiId: string) => {
    setProcessing('transcribing')
    if (pollRef.current) clearInterval(pollRef.current)

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/interviews/transcript-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recording_id: recordingId, assemblyai_id: assemblyaiId }),
        })
        const data = await res.json()

        if (data.status === 'error') {
          clearInterval(pollRef.current!)
          setProcessing('error')
          setErrorMsg(data.error || 'Transcription failed')
          return
        }

        if (data.status === 'completed') {
          clearInterval(pollRef.current!)
          setProcessing('analysing')

          const analyseRes = await fetch('/api/interviews/analyse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript_id: data.transcript_id }),
          })
          const analyseData = await analyseRes.json()

          if (analyseData.error) {
            setProcessing('error')
            setErrorMsg(analyseData.error)
            return
          }

          setLocalAnalysis(analyseData.analysis_text)
          setProcessing('done')
          router.refresh()
        }
      } catch {
        clearInterval(pollRef.current!)
        setProcessing('error')
        setErrorMsg('Polling failed — please refresh the page')
      }
    }, 8000)
  }, [router])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setProcessing('uploading')
    setErrorMsg(null)
    setLocalAnalysis(null)

    try {
      const filePath = `${jobId}/interview-${activeTab}-${Date.now()}-${file.name}`
      const { error: storageError } = await supabase.storage
        .from('interview-recordings')
        .upload(filePath, file)
      if (storageError) throw new Error(storageError.message)

      const { data: { user } } = await supabase.auth.getUser()
      const { data: newRecording, error: insertError } = await supabase
        .from('interview_recordings')
        .insert({ job_id: jobId, user_id: user!.id, interview_number: activeTab, file_path: filePath, file_name: file.name })
        .select()
        .single()
      if (insertError || !newRecording) throw new Error(insertError?.message || 'Insert failed')

      setProcessing('submitting')
      const transcribeRes = await fetch('/api/interviews/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recording_id: newRecording.id }),
      })
      const transcribeData = await transcribeRes.json()
      if (transcribeData.error) throw new Error(transcribeData.error)

      startPolling(newRecording.id, transcribeData.assemblyai_id)
      router.refresh()
    } catch (err) {
      setProcessing('error')
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const statusLabel: Record<ProcessingState, string> = {
    idle: '',
    uploading: 'Uploading…',
    submitting: 'Submitting to AssemblyAI…',
    transcribing: 'Transcribing… (this may take a few minutes)',
    analysing: 'Analysing interview…',
    done: '✓ Done',
    error: '',
  }

  const isProcessing = ['uploading', 'submitting', 'transcribing', 'analysing'].includes(processing)

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {interviewNumbers.map(n => (
          <button key={n} onClick={() => setActiveTab(n)}
            className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${activeTab === n ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Interview {n}
          </button>
        ))}
        <button onClick={() => setActiveTab(interviewNumbers.length + 1)}
          className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
          + Add interview
        </button>
      </div>

      {/* Recording */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        {recording ? (
          <div>
            <p className="text-sm text-gray-700">🎙 {recording.file_name}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Uploaded {new Date(recording.uploaded_at).toLocaleDateString()}
              {transcript && ' · Transcribed ✓'}
              {analysis && ' · Analysed ✓'}
            </p>
            {isProcessing && (
              <div className="mt-2 flex items-center gap-2 text-xs text-blue-600">
                <span className="animate-spin inline-block">⟳</span>
                {statusLabel[processing]}
              </div>
            )}
            {processing === 'error' && errorMsg && (
              <p className="mt-2 text-xs text-red-500">{errorMsg}</p>
            )}
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500 mb-2">No recording for Interview {activeTab}</p>
            {isProcessing ? (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <span className="animate-spin inline-block">⟳</span>
                {statusLabel[processing]}
              </div>
            ) : (
              <label className="inline-block text-sm px-3 py-1.5 rounded-lg cursor-pointer bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                ↑ Upload recording
                <input ref={fileRef} type="file" accept="audio/*,video/*" onChange={handleUpload} disabled={isProcessing} className="hidden" />
              </label>
            )}
            {processing === 'error' && errorMsg && (
              <p className="text-xs text-red-500 mt-1">{errorMsg}</p>
            )}
          </div>
        )}
      </div>

      {/* Transcript */}
      <div className="mb-4">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Transcript</h4>
        {transcript ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto bg-gray-50 rounded-lg p-3">
            {transcript.transcript_text}
          </p>
        ) : (
          <p className="text-sm text-gray-400 italic">
            {processing === 'transcribing' ? 'Transcribing… check back in a minute'
              : recording ? 'Transcription not yet started'
              : 'Upload a recording to generate a transcript'}
          </p>
        )}
      </div>

      {/* Analysis */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Analysis</h4>
        {(analysis || localAnalysis) ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto bg-gray-50 rounded-lg p-3">
            {analysis?.analysis_text ?? localAnalysis}
          </p>
        ) : (
          <p className="text-sm text-gray-400 italic">
            {processing === 'analysing' ? 'Analysing interview…'
              : transcript ? 'Analysis pending'
              : 'No analysis yet'}
          </p>
        )}
      </div>
    </div>
  )
}