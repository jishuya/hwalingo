/** Collapse OCR whitespace, including line breaks, into single spaces. */
export function tidyOcrWhitespace(text: string): string {
  return text.replace(/\s+/gu, ' ').trim()
}
