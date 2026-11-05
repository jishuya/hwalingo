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

test('Korean explanations reject foreign prose even when a Korean fragment is present', async () => {
  const { isKoreanExplanation } = await import('./vocabularyPresentation.js')
  for (const value of ['임기 말의 권력 약화 상태', '의석 3개를 되찾았어요.', '그는 퍼즐에 도전해요.']) {
    assert.equal(isKoreanExplanation(value), true, value)
  }
  for (const value of ['', '뜻: power declines at the end of a term', '뜻: le pouvoir diminue',
    '임기 말に公職者の権限が減る', '뜻: 任期结束时权力减弱']) {
    assert.equal(isKoreanExplanation(value), false, value)
    assert.equal(isKoreanExplanation(value, true), false, value)
  }
  for (const value of ["'salt'에서 유래했어요.", "'奪'와 '還'이 합쳐진 말이에요.",
    "'reluctant'를 보며 '릴랙스 좀!' 하고 소파에 붙은 모습을 떠올려요.", '“résilience”는 다시 일어서는 모습으로 기억해요.']) {
    assert.equal(isKoreanExplanation(value, true), true, value)
    assert.equal(isKoreanExplanation(value), false, value)
  }
  assert.equal(isKoreanExplanation("'한국어 mixed prose'라고 써요.", true), false)
  assert.equal(isKoreanExplanation("'foreign text only'", true), false)
})
