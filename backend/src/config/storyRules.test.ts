import assert from 'node:assert/strict'
import { test } from 'node:test'
import { countStorySentences, validateStorySentences } from './storyRules.js'

test('sentence limits work across supported learning languages', () => {
  for (const [language, sentences] of [
    ['en', ['Mina opens the door.', 'She finds a letter.', 'She reads it carefully.']],
    ['ko', ['미나는 문을 열었어요.', '편지를 발견했어요.', '천천히 읽었어요.']],
    ['ja', ['ミナはドアを開けました。', '手紙を見つけました。', 'ゆっくり読みました。']],
    ['zh', ['米娜打开门。', '她发现了一封信。', '她慢慢地读了起来。']],
    ['fr', ['Mina ouvre la porte.', 'Elle trouve une lettre.', 'Elle la lit lentement.']],
  ] as const) {
    assert.equal(countStorySentences(sentences.join(' '), language), 3)
    assert.doesNotThrow(() => validateStorySentences([...sentences], 'short', language))
  }
})

test('rejects too few, too many, empty, and disguised multi-sentence entries', () => {
  assert.throws(() => validateStorySentences(['One.', 'Two.'], 'short', 'en'))
  assert.throws(() => validateStorySentences(Array(5).fill('A short sentence.'), 'short', 'en'))
  assert.throws(() => validateStorySentences(['One.', '', 'Three.'], 'short', 'en'))
  assert.throws(() => validateStorySentences(['One. Two.', 'Three.', 'Four.'], 'short', 'en'))
  assert.throws(() => validateStorySentences(['一。二。', '三。', '四。'], 'short', 'zh'))
  assert.throws(() => validateStorySentences(null, 'short', 'en'))
  assert.doesNotThrow(() => validateStorySentences(Array(6).fill('A full sentence.'), 'medium', 'en'))
  assert.doesNotThrow(() => validateStorySentences(Array(9).fill('A full sentence.'), 'long', 'en'))
})
