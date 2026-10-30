/** Normalize OCR spacing while preserving line breaks and paragraph boundaries. */
export function tidyOcrWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/[^\S\n]+/gu, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
