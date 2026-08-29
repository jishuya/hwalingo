interface AIUsage {
  input_tokens?: number
  output_tokens?: number
  total_tokens?: number
  input_tokens_details?: { cached_tokens?: number }
  output_tokens_details?: { reasoning_tokens?: number }
}

interface AIResponseMetadata {
  model?: string
  status?: string
  output_text?: string
  incomplete_details?: { reason?: string } | null
  usage?: AIUsage | null
  _request_id?: string | null
}

interface AIErrorMetadata {
  name?: string
  status?: number
  code?: string
  request_id?: string
}

type AIContext = Record<string, string | number | boolean | undefined>

export async function observeAIRequest<T>(operation: string, request: () => Promise<T>, context: AIContext = {}): Promise<T> {
  const startedAt = performance.now()
  try {
    const response = await request()
    const metadata = response as AIResponseMetadata
    const usage = metadata.usage
    console.info(JSON.stringify({
      event: 'ai_request_completed',
      operation,
      ...context,
      durationMs: Math.round(performance.now() - startedAt),
      model: metadata.model,
      responseStatus: metadata.status,
      incompleteReason: metadata.incomplete_details?.reason,
      requestId: metadata._request_id,
      outputCharacters: metadata.output_text?.length,
      inputTokens: usage?.input_tokens,
      cachedInputTokens: usage?.input_tokens_details?.cached_tokens,
      outputTokens: usage?.output_tokens,
      reasoningTokens: usage?.output_tokens_details?.reasoning_tokens,
      totalTokens: usage?.total_tokens,
    }))
    return response
  } catch (error) {
    const metadata = error as AIErrorMetadata
    console.error(JSON.stringify({
      event: 'ai_request_failed',
      operation,
      ...context,
      durationMs: Math.round(performance.now() - startedAt),
      errorName: metadata.name,
      status: metadata.status,
      code: metadata.code,
      requestId: metadata.request_id,
    }))
    throw error
  }
}
