export interface OcrResult {
  text: string
  confidence: number | null
  languages: { code: string; confidence: number | null }[]
}

export async function extractImageText(file: File, signal: AbortSignal): Promise<OcrResult> {
  const body = new FormData()
  body.append('image', file)
  const response = await fetch('/api/ocr', { method: 'POST', credentials: 'include', body, signal })
  const result = await response.json().catch(() => ({})) as Partial<OcrResult> & { message?: string }
  if (!response.ok || typeof result.text !== 'string') throw new Error(result.message ?? '글자 추출을 완료하지 못했습니다.')
  return { text: result.text, confidence: result.confidence ?? null, languages: result.languages ?? [] }
}
