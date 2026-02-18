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

  const { recording_id } = await request.json()
  if (!recording_id) return NextResponse.json({ error: 'recording_id required' }, { status: 400 })

  const { data: recording, error: recError } = await supabase
    .from('interview_recordings')
    .select('*')
    .eq('id', recording_id)
    .eq('user_id', user.id)
    .single()

  if (recError || !recording) {
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
  }

  // Get a signed URL valid for 1 hour so AssemblyAI can download the file
  const { data: signedUrlData, error: urlError } = await supabase.storage
    .from('interview-recordings')
    .createSignedUrl(recording.file_path, 3600)

  if (urlError || !signedUrlData?.signedUrl) {
    return NextResponse.json({ error: 'Could not generate signed URL' }, { status: 500 })
  }

  const assemblyKey = process.env.ASSEMBLYAI_API_KEY
  if (!assemblyKey) return NextResponse.json({ error: 'ASSEMBLYAI_API_KEY not set' }, { status: 500 })

  const aaiResponse = await trackedFetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      authorization: assemblyKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: signedUrlData.signedUrl,
      speaker_labels: true,
      punctuate: true,
      format_text: true,
      language_detection: true,
      summarization: true,
      summary_model: 'informative',
      summary_type: 'bullets',
      iab_categories: true,
    }),
  }, { service: 'assemblyai', endpoint: '/v2/transcript', metadata: { recording_id } })

  if (!aaiResponse.ok) {
    const err = await aaiResponse.text()
    return NextResponse.json({ error: `AssemblyAI error: ${err}` }, { status: 500 })
  }

  const aaiData = await aaiResponse.json()

  await supabase
    .from('interview_recordings')
    .update({ assemblyai_id: aaiData.id, transcription_status: 'submitted' })
    .eq('id', recording_id)

  return NextResponse.json({ assemblyai_id: aaiData.id, status: aaiData.status })
}