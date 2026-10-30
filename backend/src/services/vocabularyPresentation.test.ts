import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isKanaReading, isPoliteEtymology } from './vocabularyPresentation.js'

test('Japanese pronunciation accepts kana readings and rejects other transcription systems', () => {
  for (const reading of ['ちょうせんします', 'チャレンジ', 'スーパー', 'とり くむ']) {
    assert.equal(isKanaReading(reading), true, reading)
  }
  for (const reading of ['', '/tɕoːseɴɕimasɯ/', 'chōsen shimasu', '挑戦します', '/ちょうせんします/']) {
    assert.equal(isKanaReading(reading), false, reading)
  }
})

test('etymology accepts polite explanations across languages and unknown origins', () => {
  for (const explanation of ['', '  ', '라틴어에서 유래했어요.', '한자 挑와 戦이 합쳐진 말이에요.',
    '중국어에서 전해진 말이에요.', '프랑스어에서 유래했어요.', '옛 한국어에서 온 표현이에요.',
    '도전한다는 뜻이에요. 두 한자가 합쳐졌어요.']) {
    assert.equal(isPoliteEtymology(explanation), true, explanation)
  }
  for (const explanation of ['두 한자가 합쳐진 말이다.', '라틴어에서 유래한다.', '도전을 뜻합니다.',
    '한자에서 왔다. 도전을 뜻해요.', '한자어']) {
    assert.equal(isPoliteEtymology(explanation), false, explanation)
  }
})
