import { NextRequest, NextResponse } from 'next/server'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse')

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const data = await pdfParse(buffer)

    // Clean up extracted text and convert to basic markdown
    const lines = data.text
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)

    // Short all-caps lines are likely section headers
    const markdown = lines.map((line: string) => {
      const isHeader = line.length < 40 && line === line.toUpperCase() && /[A-Z]/.test(line)
      return isHeader ? `## ${line}` : line
    }).join('\n\n')

    return NextResponse.json({ markdown })
  } catch {
    return NextResponse.json({ error: 'Failed to parse PDF' }, { status: 500 })
  }
}