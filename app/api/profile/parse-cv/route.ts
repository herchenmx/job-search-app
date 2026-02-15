export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PDFParse, VerbosityLevel } from 'pdf-parse'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 })
  }

  let parser: PDFParse | undefined

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    parser = new PDFParse({ data: buffer, verbosity: VerbosityLevel.ERRORS })
    const result = await parser.getText()

    if (!result.text || result.text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Could not extract text from PDF. The file may be image-based or empty.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      text: result.text.trim(),
      pages: result.total,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to parse PDF' },
      { status: 500 }
    )
  } finally {
    if (parser) await parser.destroy()
  }
}
