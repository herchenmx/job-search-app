import { describe, it, expect } from 'vitest'
import {
  extractJson,
  parseMatchRate,
  sanitizeInsights,
  parseAnalysisResponse,
  getScoreColor,
} from './scoring'

describe('extractJson', () => {
  it('extracts a JSON object from plain text', () => {
    const result = extractJson('{"rate": 85}')
    expect(result).toEqual({ rate: 85 })
  })

  it('extracts JSON wrapped in markdown fences', () => {
    const text = '```json\n{"score": 72, "insights": "good"}\n```'
    const result = extractJson(text)
    expect(result).toEqual({ score: 72, insights: 'good' })
  })

  it('extracts JSON embedded in surrounding prose', () => {
    const text = 'Here is my analysis:\n\n{"experienceMatchRate": 65, "experienceMatchInsights": "Strong match"}\n\nHope this helps!'
    const result = extractJson(text)
    expect(result).toEqual({ experienceMatchRate: 65, experienceMatchInsights: 'Strong match' })
  })

  it('returns null when no JSON is present', () => {
    expect(extractJson('No JSON here')).toBeNull()
    expect(extractJson('')).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(extractJson('{invalid json}')).toBeNull()
  })

  it('handles nested objects by extracting the outermost braces', () => {
    const text = '{"a": {"b": 1}, "c": 2}'
    const result = extractJson(text)
    expect(result).toEqual({ a: { b: 1 }, c: 2 })
  })
})

describe('parseMatchRate', () => {
  it('parses a plain number', () => {
    expect(parseMatchRate(85)).toBe(85)
  })

  it('parses a string number', () => {
    expect(parseMatchRate('72')).toBe(72)
  })

  it('strips a percentage suffix', () => {
    expect(parseMatchRate('90%')).toBe(90)
  })

  it('handles zero', () => {
    expect(parseMatchRate(0)).toBe(0)
    expect(parseMatchRate('0')).toBe(0)
  })

  it('handles decimal values', () => {
    expect(parseMatchRate(77.5)).toBe(77.5)
    expect(parseMatchRate('77.5%')).toBe(77.5)
  })

  it('returns NaN for null/undefined', () => {
    expect(parseMatchRate(null)).toBeNaN()
    expect(parseMatchRate(undefined)).toBeNaN()
  })

  it('returns NaN for non-numeric strings', () => {
    expect(parseMatchRate('high')).toBeNaN()
    expect(parseMatchRate('N/A')).toBeNaN()
  })

  it('returns NaN for Infinity', () => {
    expect(parseMatchRate(Infinity)).toBeNaN()
    expect(parseMatchRate('Infinity')).toBeNaN()
  })

  it('handles whitespace around value', () => {
    expect(parseMatchRate('  85  ')).toBe(85)
    expect(parseMatchRate('  70% ')).toBe(70)
  })
})

describe('sanitizeInsights', () => {
  it('removes double quotes', () => {
    expect(sanitizeInsights('She said "hello"')).toBe('She said hello')
  })

  it('removes bold markdown', () => {
    expect(sanitizeInsights('This is **bold** text')).toBe('This is bold text')
  })

  it('removes italic markdown', () => {
    expect(sanitizeInsights('This is *italic* text')).toBe('This is italic text')
  })

  it('truncates to maxLength', () => {
    const long = 'a'.repeat(3000)
    expect(sanitizeInsights(long, 2000)).toHaveLength(2000)
  })

  it('uses default maxLength of 2000', () => {
    const long = 'b'.repeat(3000)
    expect(sanitizeInsights(long)).toHaveLength(2000)
  })

  it('handles null/undefined gracefully', () => {
    expect(sanitizeInsights(null)).toBe('')
    expect(sanitizeInsights(undefined)).toBe('')
  })

  it('converts non-string values to string', () => {
    expect(sanitizeInsights(42)).toBe('42')
  })
})

describe('parseAnalysisResponse', () => {
  it('parses a valid experience match response', () => {
    const text = '{"experienceMatchRate": 82, "experienceMatchInsights": "Strong alignment with requirements"}'
    const result = parseAnalysisResponse(text, 'experienceMatchRate', 'experienceMatchInsights')
    expect(result).toEqual({
      rate: 82,
      insights: 'Strong alignment with requirements',
    })
  })

  it('parses a valid job match response', () => {
    const text = '{"jobMatchRate": 65, "jobMatchInsights": "Moderate fit"}'
    const result = parseAnalysisResponse(text, 'jobMatchRate', 'jobMatchInsights')
    expect(result).toEqual({ rate: 65, insights: 'Moderate fit' })
  })

  it('parses a valid culture match response', () => {
    const text = '{"culturalMatchRate": 90, "culturalMatchInsights": "Excellent culture fit"}'
    const result = parseAnalysisResponse(text, 'culturalMatchRate', 'culturalMatchInsights')
    expect(result).toEqual({ rate: 90, insights: 'Excellent culture fit' })
  })

  it('handles rate with percentage suffix', () => {
    const text = '{"experienceMatchRate": "75%", "experienceMatchInsights": "Good match"}'
    const result = parseAnalysisResponse(text, 'experienceMatchRate', 'experienceMatchInsights')
    expect(result).toEqual({ rate: 75, insights: 'Good match' })
  })

  it('sanitizes markdown from insights', () => {
    const text = '{"jobMatchRate": 70, "jobMatchInsights": "The role is **excellent** for *this* candidate"}'
    const result = parseAnalysisResponse(text, 'jobMatchRate', 'jobMatchInsights')
    expect(result).toEqual({
      rate: 70,
      insights: 'The role is excellent for this candidate',
    })
  })

  it('returns error when no JSON found', () => {
    const result = parseAnalysisResponse('No JSON here', 'jobMatchRate', 'jobMatchInsights')
    expect(result).toEqual({ error: 'No JSON found in response' })
  })

  it('returns error when rate field is missing', () => {
    const text = '{"otherField": 80, "jobMatchInsights": "test"}'
    const result = parseAnalysisResponse(text, 'jobMatchRate', 'jobMatchInsights')
    expect(result).toHaveProperty('error')
  })

  it('returns error when rate is non-numeric', () => {
    const text = '{"experienceMatchRate": "high", "experienceMatchInsights": "test"}'
    const result = parseAnalysisResponse(text, 'experienceMatchRate', 'experienceMatchInsights')
    expect(result).toHaveProperty('error')
  })

  it('handles JSON embedded in prose from AI', () => {
    const text = 'Here is my analysis:\n\n{"culturalMatchRate": 55, "culturalMatchInsights": "Some gaps noted"}\n\nLet me know if you have questions.'
    const result = parseAnalysisResponse(text, 'culturalMatchRate', 'culturalMatchInsights')
    expect(result).toEqual({ rate: 55, insights: 'Some gaps noted' })
  })
})

describe('getScoreColor', () => {
  it('returns green for scores >= 80', () => {
    expect(getScoreColor(80)).toBe('text-green-700')
    expect(getScoreColor(95)).toBe('text-green-700')
    expect(getScoreColor(100)).toBe('text-green-700')
  })

  it('returns yellow for scores >= 60 and < 80', () => {
    expect(getScoreColor(60)).toBe('text-yellow-700')
    expect(getScoreColor(70)).toBe('text-yellow-700')
    expect(getScoreColor(79)).toBe('text-yellow-700')
  })

  it('returns red for scores < 60', () => {
    expect(getScoreColor(0)).toBe('text-red-700')
    expect(getScoreColor(30)).toBe('text-red-700')
    expect(getScoreColor(59)).toBe('text-red-700')
  })
})
