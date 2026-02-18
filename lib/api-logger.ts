import { createClient } from '@supabase/supabase-js'

interface LogParams {
  service: string
  endpoint: string
  method?: string
  metadata?: Record<string, unknown>
}

let _serviceClient: ReturnType<typeof createClient> | null = null

function getServiceClient() {
  if (!_serviceClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return null
    _serviceClient = createClient(url, key)
  }
  return _serviceClient
}

/**
 * Log an external API call to the api_call_logs table.
 * Fire-and-forget — never blocks the caller.
 */
export function logApiCall(data: LogParams & {
  status_code?: number | null
  duration_ms?: number | null
  error?: string | null
}) {
  const client = getServiceClient()
  if (!client) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(client.from('api_call_logs') as any)
    .insert({
      service: data.service,
      endpoint: data.endpoint,
      method: data.method || 'POST',
      status_code: data.status_code ?? null,
      duration_ms: data.duration_ms ?? null,
      error: data.error ?? null,
      metadata: data.metadata || {},
    })
    .then(() => {})
    .catch(() => {})
}

/**
 * Drop-in replacement for fetch() that times and logs the call.
 * Returns the original Response untouched.
 */
export async function trackedFetch(
  url: string | URL | Request,
  options: RequestInit | undefined,
  logParams: LogParams
): Promise<Response> {
  const start = Date.now()
  try {
    const response = await fetch(url, options)
    const duration = Date.now() - start
    logApiCall({
      ...logParams,
      method: logParams.method || options?.method || 'GET',
      status_code: response.status,
      duration_ms: duration,
    })
    return response
  } catch (err) {
    const duration = Date.now() - start
    logApiCall({
      ...logParams,
      method: logParams.method || options?.method || 'GET',
      duration_ms: duration,
      error: err instanceof Error ? err.message : 'Unknown fetch error',
    })
    throw err
  }
}
