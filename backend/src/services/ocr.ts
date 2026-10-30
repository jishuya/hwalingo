import { ImageAnnotatorClient } from '@google-cloud/vision'

let client: ImageAnnotatorClient | undefined

export async function extractImageText(image: Buffer): Promise<{ text: string; confidence: number | null; languages: { code: string; confidence: number | null }[] }> {
  client ??= new ImageAnnotatorClient()
  const [batch] = await client.batchAnnotateImages(
    { requests: [{ image: { content: image }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }] }] },
    { timeout: 25_000, retry: null },
  )
  const result = batch.responses?.[0]
  if (!result) throw new Error('Empty Vision response')
  if (result.error?.code) throw Object.assign(new Error('Vision request failed'), { code: result.error.code })
  const annotation = result.fullTextAnnotation
  const scores: number[] = []
  const languages = new Map<string, number | null>()
  const validScore = (value: number | null | undefined): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
  for (const page of annotation?.pages ?? []) {
    if (validScore(page.confidence)) scores.push(page.confidence)
    for (const language of page.property?.detectedLanguages ?? []) {
      if (!language.languageCode) continue
      const score = validScore(language.confidence) ? language.confidence : null
      const previous = languages.get(language.languageCode)
      languages.set(language.languageCode, score === null ? previous ?? null : Math.max(previous ?? 0, score))
    }
  }
  return {
    text: annotation?.text?.trim() ?? '',
    confidence: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
    languages: [...languages].map(([code, confidence]) => ({ code, confidence })),
  }
}
