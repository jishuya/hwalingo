import assert from 'node:assert/strict'
import { test } from 'node:test'
import { selectTestCandidates, type TestCandidate } from './testSelection.js'

const now = new Date('2026-10-30T00:00:00Z')
function candidates(prefix: string, count: number, totalAttempts: number, daysUntilReview = 0): TestCandidate[] {
  return Array.from({ length: count }, (_, index) => ({
    vocabularyId: `${prefix}-${index}`, masteryLevel: 6, totalAttempts,
    correctCount: totalAttempts, incorrectCount: 0,
    nextReviewAt: new Date(now.getTime() + daysUntilReview * 86_400_000 + index),
    lastReviewedAt: totalAttempts ? new Date('2026-09-01') : null,
  }))
}

test('first test uses ten new words without duplicates', () => {
  const selected = selectTestCandidates(candidates('new', 12, 0), 10, now)
  assert.equal(selected.length, 10)
  assert.ok(selected.every(item => item.selectionGroup === 'new'))
  assert.equal(new Set(selected.map(item => item.vocabularyId)).size, 10)
})

test('standard tests split new and due words evenly and prioritize overdue masters', () => {
  for (const count of [10, 20, 30]) {
    const due = candidates('due', 30, 1, -1)
    const selected = selectTestCandidates([...candidates('new', 30, 0), ...due], count, now)
    assert.equal(selected.filter(item => item.selectionGroup === 'new').length, count / 2)
    assert.deepEqual(selected.filter(item => item.selectionGroup === 'due').map(item => item.vocabularyId),
      due.slice(0, count / 2).map(item => item.vocabularyId))
  }
})

test('shortages use the other group and never use future reviews', () => {
  for (const [fresh, due, expectedNew, expectedDue] of [[8, 2, 8, 2], [3, 20, 3, 7], [2, 4, 2, 4]]) {
    const selected = selectTestCandidates([
      ...candidates('new', fresh, 0), ...candidates('due', due, 1, -1),
      ...candidates('future', 20, 1, 1),
    ], 10, now)
    assert.equal(selected.length, expectedNew + expectedDue)
    assert.equal(selected.filter(item => item.selectionGroup === 'new').length, expectedNew)
    assert.equal(selected.filter(item => item.selectionGroup === 'due').length, expectedDue)
    assert.ok(selected.every(item => !item.vocabularyId.startsWith('future')))
  }
})
