export interface SentenceAnalysis {
  backgroundKnowledge: string
  sentence: string
  translation: string
  chunks: Array<{ english: string; korean: string }>
  paraphrases: Array<{ level: string; sentence: string }>
  vocabulary: Array<{ word: string; meaning: string; level: string }>
}

export async function analyzeSentence(text: string): Promise<SentenceAnalysis> {
  const response = await fetch('/api/analysis', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
  })
  const result = await response.json().catch(() => ({})) as { analysis?: SentenceAnalysis; message?: string }
  if (!response.ok || !result.analysis) throw new Error(result.message ?? 'AI 분석을 완료하지 못했습니다.')
  return result.analysis
}
