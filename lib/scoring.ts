/**
 * Shared utilities for AI-driven scoring and match rate parsing.
 *
 * All three analysis cron jobs (experience, role, culture) follow the same
 * pattern: ask an AI for JSON with a numeric rate and a text insights field,
 * then parse, validate, and sanitize the response. This module extracts that
 * common logic so it can be tested and reused.
 */

/** Extract the first JSON object from a string (handles markdown fences, etc.) */
export function extractJson(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

/** Parse a match rate value that may be a number, string, or string with "%" suffix. Returns NaN on failure. */
export function parseMatchRate(value: unknown): number {
  if (value === null || value === undefined) return NaN
  const cleaned = String(value).replace('%', '').trim()
  const num = Number(cleaned)
  if (!isFinite(num)) return NaN
  return num
}

/** Strip markdown formatting and quotes from insights text, then truncate. */
export function sanitizeInsights(text: unknown, maxLength = 2000): string {
  return String(text ?? '')
    .replaceAll('"', '')
    .replaceAll('**', '')
    .replaceAll('*', '')
    .substring(0, maxLength)
}

/**
 * Parse a full AI response into a rate + insights pair.
 *
 * @param text       Raw text from the AI response
 * @param rateField  The JSON key containing the numeric rate (e.g. "experienceMatchRate")
 * @param insightsField  The JSON key containing the insights text
 * @returns Parsed result or an error string
 */
export function parseAnalysisResponse(
  text: string,
  rateField: string,
  insightsField: string,
): { rate: number; insights: string } | { error: string } {
  const json = extractJson(text)
  if (!json) return { error: 'No JSON found in response' }

  const rate = parseMatchRate(json[rateField])
  if (isNaN(rate)) return { error: `Invalid ${rateField}: ${json[rateField]}` }

  const insights = sanitizeInsights(json[insightsField])
  return { rate, insights }
}

/** Return a Tailwind text colour class for a score (0–100). */
export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-700'
  if (score >= 60) return 'text-yellow-700'
  return 'text-red-700'
}
