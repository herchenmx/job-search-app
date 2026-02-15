export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

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

  try {
    const buffer = new Uint8Array(await file.arrayBuffer())
    const doc = await getDocument({ data: buffer, verbosity: 0 }).promise

    const numPages = doc.numPages
    const pageTexts: string[] = []
    for (let i = 1; i <= numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      // TextItem has 'str', TextMarkedContent does not — filter to text items only
      const text = content.items
        .filter((item) => 'str' in item)
        .map((item) => (item as { str: string }).str)
        .join(' ')
      pageTexts.push(text)
    }
    doc.destroy()

    const fullText = pageTexts.join('\n\n')

    if (!fullText.trim()) {
      return NextResponse.json(
        { error: 'Could not extract text from PDF. The file may be image-based or empty.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      text: fullText.trim(),
      pages: numPages,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to parse PDF' },
      { status: 500 }
    )
  }
}
