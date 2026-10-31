import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rankWeakWords } from '../src/domain/weakWords.ts'
const word = (id: string, wrong: number, attempts: number, last = '2026-10-31T00:00:00Z') => ({ vocabularyId: id, progress: { incorrectCount: wrong, totalAttempts: attempts, lastReviewedAt: last } })
test('rank by wrong count before rate, then oldest review and deterministic id', () => {
  const words = [word('1',1,1),word('2',5,20),word('3',5,10),word('4',5,10,'2026-10-30T00:00:00Z'),word('10',5,10,'2026-10-30T00:00:00Z'),word('5',0,10),word('6',0,0)]
  const original = [...words]
  assert.deepEqual(rankWeakWords(words).map(item => item.vocabularyId), ['4','10','3','2','1'])
  assert.deepEqual(words, original)
})
test('empty records, first answer with one wrong, and top five cap', () => {
  assert.deepEqual(rankWeakWords([]), [])
  assert.deepEqual(rankWeakWords([word('1',0,20),word('2',0,0)]), [])
  assert.equal(rankWeakWords([word('1',1,1)])[0].progress.incorrectCount, 1)
  assert.equal(rankWeakWords(Array.from({length:10},(_,index) => word(String(index),1,2))).length, 5)
})
