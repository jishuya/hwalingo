export async function extractImageText(file: File, signal: AbortSignal): Promise<string> {
  const body = new FormData()
  body.append('image', file)
  const response = await fetch('/api/ocr', { method: 'POST', credentials: 'include', body, signal })
  const result = await response.json().catch(() => ({})) as { text?: string; message?: string }
  if (!response.ok || typeof result.text !== 'string') throw new Error(result.message ?? '글자 추출을 완료하지 못했습니다.')
  return result.text
}
