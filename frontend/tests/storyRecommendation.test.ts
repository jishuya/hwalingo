import assert from 'node:assert/strict'
import { test } from 'node:test'
import { recommendStoryWords } from '../src/domain/storyRecommendation.ts'

const now = Date.parse('2026-10-30T00:00:00Z')
const make = (id: string, kind: 'due' | 'new' | 'familiar' | 'other', options: { language?: 'en' | 'ja'; overdueDays?: number; recent?: boolean } = {}) => ({
  vocabularyId: id, languageCode: options.language ?? 'en',
  lastStoryUsedAt: options.recent ? new Date(now - 86400000).toISOString() : null,
  progress: {
    masteryLevel: kind === 'familiar' ? 4 : 1, masteryScore: 0,
    totalAttempts: kind === 'new' ? 0 : 1, correctCount: 0, incorrectCount: 0,
    correctStreak: 0, incorrectStreak: 0, lastReviewedAt: null,
    nextReviewAt: new Date(now + (kind === 'due' ? -(options.overdueDays ?? 1) : 1) * 86400000).toISOString(),
    isDue: kind === 'due', nextReviewInDays: 0,
  },
})
const settings = { now, random: () => .5 }

test('selects 3 overdue reviews, 1 new word, and 1 familiar word', () => {
  const selected = recommendStoryWords([
    make('r1', 'due', { overdueDays: 5 }), make('r2', 'due', { overdueDays: 4 }),
    make('r3', 'due', { overdueDays: 3 }), make('r4', 'due', { overdueDays: 2 }),
    make('new', 'new'), make('familiar', 'familiar'),
  ], settings)
  assert.deepEqual(selected.map(word => word.vocabularyId), ['r1', 'r2', 'r3', 'new', 'familiar'])
})

test('recent story words lose priority within each group', () => {
  const selected = recommendStoryWords([
    make('recent', 'due', { recent: true, overdueDays: 10 }),
    make('r1', 'due'), make('r2', 'due'), make('r3', 'due'), make('new', 'new'), make('familiar', 'familiar'),
  ], settings)
  assert.ok(!selected.some(word => word.vocabularyId === 'recent'))
})

test('fills missing groups without duplicates and stays in one language', () => {
  const source = Array.from({ length: 6 }, (_, index) => make(`en${index}`, 'new'))
  const selected = recommendStoryWords([...source, source[0], make('ja', 'due', { language: 'ja' })], settings)
  assert.equal(selected.length, 5)
  assert.equal(new Set(selected.map(word => word.vocabularyId)).size, 5)
  assert.ok(selected.every(word => word.languageCode === 'en'))
  assert.equal(recommendStoryWords(source.slice(0, 2), settings).length, 0)
})

test('does not recommend an explicit language with fewer than three words', () => {
  const selected = recommendStoryWords([
    ...Array.from({ length: 6 }, (_, index) => make(`en${index}`, 'new')),
    make('ja1', 'new', { language: 'ja' }), make('ja2', 'familiar', { language: 'ja' }),
  ], { ...settings, language: 'ja' })
  assert.equal(selected.length, 0)
  assert.ok(selected.every(word => word.languageCode === 'ja'))
})

test('tie-breaking varies by random input without losing group quotas', () => {
  const source = Array.from({ length: 10 }, (_, index) => make(`${index}`, 'new'))
  assert.notDeepEqual(recommendStoryWords(source, { now, random: () => 0 }).map(word => word.vocabularyId),
    recommendStoryWords(source, { now, random: () => .99 }).map(word => word.vocabularyId))
  assert.deepEqual(recommendStoryWords([], settings), [])
})


test('each click recalculates and changes the previous set when alternatives exist', () => {
  const source = Array.from({ length: 8 }, (_, index) => make(`${index}`, 'new'))
  const first = recommendStoryWords(source, settings)
  const second = recommendStoryWords(source, { ...settings, previousIds: first.map(word => word.vocabularyId) })
  assert.equal(second.length, 5)
  assert.equal(new Set(second.map(word => word.vocabularyId)).size, 5)
  assert.ok(second.some(word => !first.some(previous => previous.vocabularyId === word.vocabularyId)))
  const third = recommendStoryWords(source, { ...settings, previousIds: second.map(word => word.vocabularyId) })
  assert.ok(third.some(word => !second.some(previous => previous.vocabularyId === word.vocabularyId)))
})

test('rotates a fallback word even when all quota groups are fixed', () => {
  const source = [make('r1', 'due'), make('r2', 'due'), make('r3', 'due'), make('n', 'new'), make('f', 'familiar'), make('extra', 'other')]
  const first = recommendStoryWords(source, settings)
  const second = recommendStoryWords(source, { ...settings, previousIds: first.map(word => word.vocabularyId) })
  assert.ok(second.some(word => word.vocabularyId === 'extra'))
  assert.equal(second.length, 5)
})

test('keeps five unique words when there are no alternatives', () => {
  const source = Array.from({ length: 5 }, (_, index) => make(`${index}`, 'new'))
  const selected = recommendStoryWords(source, { ...settings, previousIds: source.map(word => word.vocabularyId) })
  assert.equal(selected.length, 5)
  assert.equal(new Set(selected.map(word => word.vocabularyId)).size, 5)
})

test('three words in each language stay together and repeat when that language remains selected', () => {
  const source = (['en','zh','ja'] as const).flatMap(language=>Array.from({length:3},(_,index)=>({...make(`${language}${index}`,'new'),languageCode:language})))
  const first = recommendStoryWords(source,settings)
  assert.equal(first.length,3)
  assert.equal(new Set(first.map(word=>word.languageCode)).size,1)
  const repeated = recommendStoryWords(source,{...settings,language:first[0].languageCode,previousIds:first.map(word=>word.vocabularyId)})
  assert.deepEqual(repeated.map(word=>word.vocabularyId).sort(),first.map(word=>word.vocabularyId).sort())
})

test('automatic repeat changes languages when all words in the current language were used', () => {
  for (const count of [3,4,5]) {
    const source = (['en','zh','ja'] as const).flatMap(language=>Array.from({length:count},(_,index)=>({...make(`${language}${index}`,'new'),languageCode:language})))
    let selected = recommendStoryWords(source,settings)
    for (let index=0;index<4;index++) {
      const next = recommendStoryWords(source,{...settings,language:selected[0].languageCode,previousIds:selected.map(word=>word.vocabularyId),allowLanguageChange:true})
      assert.equal(next.length,count)
      assert.notEqual(next[0].languageCode,selected[0].languageCode)
      assert.ok(next.every(word=>word.languageCode===next[0].languageCode))
      selected=next
    }
  }
})

test('automatic repeat ignores other languages with fewer than three words', () => {
  const source = [...Array.from({length:3},(_,index)=>make(`en${index}`,'new')),make('ja1','due',{language:'ja'}),make('ja2','due',{language:'ja'})]
  const selected = recommendStoryWords(source,{...settings,previousIds:['en0','en1','en2'],allowLanguageChange:true})
  assert.equal(selected.length,3)
  assert.ok(selected.every(word=>word.languageCode==='en'))
})


test('cycles through all languages with more than five words and varies words on return', () => {
  const source = (['en', 'es', 'ja'] as const).flatMap(language => Array.from({ length: 10 }, (_, index) => ({ ...make(`${language}${index}`, 'new'), languageCode: language })))
  const history: Partial<Record<'en' | 'es' | 'ja', string[]>> = {}
  let selected = recommendStoryWords(source, { ...settings, language: 'es' })
  const first = selected.map(word => word.vocabularyId)
  history.es = first
  const visited = [selected[0].languageCode]
  for (let index = 0; index < 3; index++) {
    selected = recommendStoryWords(source, { ...settings, language: selected[0].languageCode, previousIds: selected.map(word => word.vocabularyId), allowLanguageChange: true, previousByLanguage: history })
    visited.push(selected[0].languageCode)
    history[selected[0].languageCode] = selected.map(word => word.vocabularyId)
    assert.equal(selected.length, 5)
    assert.equal(new Set(selected.map(word => word.languageCode)).size, 1)
  }
  assert.equal(new Set(visited.slice(0, 3)).size, 3)
  assert.equal(visited[3], 'es')
  assert.ok(selected.every(word => !first.includes(word.vocabularyId)))
})


test('never recommends one or two words, including duplicate candidates', () => {
  const one = make('one', 'new')
  const two = make('two', 'new')
  for (const source of [[one], [one, two], [one, one, two]]) {
    assert.deepEqual(recommendStoryWords(source, settings), [])
    assert.deepEqual(recommendStoryWords(source, { ...settings, language: 'en', allowLanguageChange: true, previousIds: ['one'] }), [])
  }
  assert.equal(recommendStoryWords([one, two, make('three', 'new')], settings).length, 3)
})
