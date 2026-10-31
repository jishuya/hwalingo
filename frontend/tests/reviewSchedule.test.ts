import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildReviewSchedule } from '../src/domain/reviewSchedule.ts'

const word = (id: string, at: string, attempts = 1) => ({ id, progress: { nextReviewAt: at, totalAttempts: attempts } })
test('Seoul dates separate overdue, later today, six days ahead and unscheduled new words', () => {
  const result = buildReviewSchedule([
    word('yesterday', '2026-10-30T14:59:59Z'),
    word('today-start', '2026-10-30T15:00:00Z'),
    word('now', '2026-10-31T03:00:00Z'),
    word('later-today', '2026-10-31T14:59:59Z'),
    word('tomorrow', '2026-10-31T15:00:00Z'),
    word('day-six', '2026-11-06T14:59:59Z'),
    word('day-seven', '2026-11-06T15:00:00Z'),
    word('new', '2026-10-01T00:00:00Z', 0),
    word('invalid', 'invalid'),
  ], new Date('2026-10-31T03:00:00Z'))
  assert.equal(result.today, '2026-10-31')
  assert.deepEqual(result.overdue.map(item => item.id), ['yesterday'])
  assert.deepEqual(result.dueNow.map(item => item.id), ['yesterday', 'today-start', 'now'])
  assert.deepEqual(result.days[0].words.map(item => item.id), ['today-start', 'now', 'later-today'])
  assert.deepEqual(result.days[1].words.map(item => item.id), ['tomorrow'])
  assert.deepEqual(result.days[6].words.map(item => item.id), ['day-six'])
  assert.equal(result.days.reduce((sum, day) => sum + day.words.length, 0), 5)
})
test('year boundary and Seoul midnight move yesterday to overdue, keeping master words eligible', () => {
  const words = [word('past', '2026-12-31T14:59:59Z'), { ...word('master', '2026-12-31T15:00:00Z'), masteryLevel: 7 }]
  const result = buildReviewSchedule(words, new Date('2026-12-31T15:00:00Z'))
  assert.equal(result.today, '2027-01-01')
  assert.equal(result.days[6].date, '2027-01-07')
  assert.deepEqual(result.overdue.map(item => item.id), ['past'])
  assert.deepEqual(result.days[0].words.map(item => item.id), ['master'])
  assert.equal(result.dueNow.length, 2)
  assert.deepEqual(buildReviewSchedule([], new Date('2026-12-31T15:00:00Z')).days.map(day => day.words.length), [0,0,0,0,0,0,0])
})
