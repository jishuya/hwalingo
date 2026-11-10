import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isValidElement } from 'react'
import { highlightVocabularyText } from '../src/utils/highlightVocabularyText.ts'

function marked(text: string, word: string, memoryTip = false) {
  const result = highlightVocabularyText(text, word, 'test-highlight', memoryTip)
  if (!Array.isArray(result)) return []
  return result.filter(isValidElement<{ children: string; className: string }>).map(element => {
    assert.equal(element.type, 'mark')
    assert.equal(element.props.className, 'test-highlight')
    return element.props.children
  })
}

test('Latin words match whole words, case insensitively, while unspaced languages match within text', () => {
  assert.deepEqual(marked('Cat catches another cat.', 'cat'), ['Cat', 'cat'])
  assert.deepEqual(marked('今天学习中文。', '学习'), ['学习'])
  assert.deepEqual(marked('éclair ÉCLAIR prééclair', 'éclair'), ['éclair', 'ÉCLAIR'])
})

test('punctuation is literal and blank vocabulary leaves text unchanged', () => {
  assert.deepEqual(marked('Use c++ or c++17, never ccc.', 'c++'), ['c++'])
  assert.equal(highlightVocabularyText('unchanged', '  ', 'test-highlight'), 'unchanged')
})

test('quoted memory cues are highlighted only in memory tips', () => {
  const text = '단어는 “banana”나 「바나나」로 떠올려요.'
  assert.deepEqual(marked(text, '다른단어', true), ['“banana”', '「바나나」'])
  assert.deepEqual(marked(text, '다른단어'), [])
})
