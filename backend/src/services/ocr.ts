import { ImageAnnotatorClient } from '@google-cloud/vision'

let client: ImageAnnotatorClient | undefined

export async function extractImageText(image: Buffer): Promise<string> {
  client ??= new ImageAnnotatorClient()
  const [batch] = await client.batchAnnotateImages(
    { requests: [{ image: { content: image }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }] }] },
    { timeout: 25_000, retry: null },
  )
  const result = batch.responses?.[0]
  if (!result) throw new Error('Empty Vision response')
  if (result.error?.code) throw Object.assign(new Error('Vision request failed'), { code: result.error.code })
  return result.fullTextAnnotation?.text?.trim() ?? ''
}
