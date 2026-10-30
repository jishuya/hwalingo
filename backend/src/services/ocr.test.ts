import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ImageAnnotatorClient } from '@google-cloud/vision'
import { extractImageText } from './ocr.js'

test('OCR collects nested language information and falls back to nested confidence', async () => {
  const original = ImageAnnotatorClient.prototype.batchAnnotateImages
  let pageConfidence: number | undefined
  ImageAnnotatorClient.prototype.batchAnnotateImages = (async () => [{ responses: [{ fullTextAnnotation: {
    text: 'Bonjour', pages: [{ confidence: pageConfidence, blocks: [{ paragraphs: [{ words: [
      { confidence: .9, property: { detectedLanguages: [{ languageCode: 'fr', confidence: .98 }] } },
      { confidence: .7, property: { detectedLanguages: [{ languageCode: 'fr', confidence: .95 }] } },
    ] }] }] }],
  } }] }]) as unknown as typeof original
  try {
    const result = await extractImageText(Buffer.from('mock'))
    assert.equal(result.confidence, .8)
    assert.deepEqual(result.languages, [{ code: 'fr', confidence: .98 }])
    pageConfidence = 0
    assert.equal((await extractImageText(Buffer.from('mock'))).confidence, 0)
  } finally {
    ImageAnnotatorClient.prototype.batchAnnotateImages = original
  }
})
