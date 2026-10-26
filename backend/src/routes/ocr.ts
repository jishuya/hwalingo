import { Router } from 'express'
import multer from 'multer'
import sharp from 'sharp'
import { requireAuth } from '../middleware/requireAuth.js'
import { extractImageText } from '../services/ocr.js'

export const ocrRouter = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 } }).single('image')
const attempts = new Map<string, { count: number; expires: number }>()
const active = new Set<string>()

ocrRouter.post('/', requireAuth, (request, response) => {
  const userId = request.auth!.userId
  const now = Date.now()
  for (const [key, entry] of attempts) if (entry.expires <= now) attempts.delete(key)
  const entry = attempts.get(userId) ?? { count: 0, expires: now + 60_000 }
  if (active.has(userId) || entry.count >= 5) {
    response.setHeader('Retry-After', '60')
    response.status(429).json({ message: '사진 추출 요청이 많습니다. 1분 후 다시 시도해 주세요.' })
    return
  }
  entry.count += 1
  attempts.set(userId, entry)
  active.add(userId)
  response.once('close', () => active.delete(userId))
  upload(request, response, async error => {
    if (error) {
      response.status(error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ message: '10MB 이하의 사진 한 장을 선택해 주세요.' })
      return
    }
    if (!request.file) {
      response.status(400).json({ message: '사진을 선택해 주세요.' })
      return
    }
    let image: Buffer
    try {
      const input = sharp(request.file.buffer, { limitInputPixels: 40_000_000, animated: false })
      const metadata = await input.metadata()
      if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1) throw new Error('Unsupported image')
      image = await input.rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer()
    } catch {
      response.status(400).json({ message: 'JPEG, PNG, WebP 형식의 정상적인 사진을 선택해 주세요. 최대 4천만 화소까지 지원합니다.' })
      return
    }
    try {
      const text = await extractImageText(image)
      if (!text) {
        response.status(422).json({ message: '사진에서 글자를 찾지 못했습니다. 글자가 선명하게 나오도록 다시 촬영해 주세요.' })
        return
      }
      response.json({ text })
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
      const [status, message] = code === 4
        ? [504, '글자 추출 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.']
        : code === 8
          ? [429, '글자 추출 서비스의 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.']
          : code === 7 || code === 16 || code === 9
            ? [503, '글자 추출 서비스의 인증 또는 설정을 확인해야 합니다. 관리자에게 문의해 주세요.']
            : [503, '글자 추출 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.']
      // Do not log images, extracted text, or credential details.
      console.error('OCR request failed', { code })
      response.status(status as number).json({ message })
    }
  })
})
