export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { trackedFetch } from '@/lib/api-logger'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { recording_id, assemblyai_id } = await request.json()
  if (!recording_id || !assemblyai_id) {
    return NextResponse.json({ error: 'recording_id and assemblyai_id required' }, { status: 400 })
  }

  const assemblyKey = process.env.ASSEMBLYAI_API_KEY
  if (!assemblyKey) return NextResponse.json({ error: 'ASSEMBLYAI_API_KEY not set' }, { status: 500 })

  // Poll AssemblyAI for status
  const aaiResponse = await trackedFetch(`https://api.assemblyai.com/v2/transcript/${assemblyai_id}`, {
    headers: { authorization: assemblyKey },
  }, { service: 'assemblyai', endpoint: '/v2/transcript/:id', method: 'GET', metadata: { assemblyai_id } })

  if (!aaiResponse.ok) {
    return NextResponse.json({ error: 'AssemblyAI poll failed' }, { status: 500 })
  }

  const aaiData = await aaiResponse.json()

  if (aaiData.status === 'error') {
    await supabase
      .from('interview_recordings')
      .update({ transcription_status: 'error' })
      .eq('id', recording_id)
    return NextResponse.json({ status: 'error', error: aaiData.error })
  }

  if (aaiData.status !== 'completed') {
    await supabase
      .from('interview_recordings')
      .update({ transcription_status: 'processing' })
      .eq('id', recording_id)
    return NextResponse.json({ status: aaiData.status })
  }

  // Completed — format transcript with speaker labels if available
  let transcriptText: string
  if (aaiData.utterances?.length > 0) {
    transcriptText = aaiData.utterances
      .map((u: { speaker: string; text: string }) => `Speaker ${u.speaker}: ${u.text}`)
      .join('\n\n')
  } else {
    transcriptText = aaiData.text || ''
  }

  // Get recording to find job_id and interview_number
  const { data: recording } = await supabase
    .from('interview_recordings')
    .select('job_id, interview_number, user_id')
    .eq('id', recording_id)
    .single()

  if (!recording) return NextResponse.json({ error: 'Recording not found' }, { status: 404 })

  // Save transcript to DB
  const { data: transcript, error: transcriptError } = await supabase
    .from('interview_transcripts')
    .insert({
      job_id: recording.job_id,
      recording_id,
      interview_number: recording.interview_number,
      transcript_text: transcriptText,
    })
    .select()
    .single()

  if (transcriptError) {
    return NextResponse.json({ error: transcriptError.message }, { status: 500 })
  }

  // Mark recording as completed
  await supabase
    .from('interview_recordings')
    .update({ transcription_status: 'completed' })
    .eq('id', recording_id)

  return NextResponse.json({ status: 'completed', transcript_id: transcript.id })
}