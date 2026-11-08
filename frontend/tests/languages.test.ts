import assert from 'node:assert/strict'
import { test } from 'node:test'
import { detectLanguage } from '../src/utils/detectLanguage.ts'

test('detects German and Spanish alongside existing languages', () => {
  const cases = [
    ['Ich möchte heute Deutsch lernen.', 'de'],
    ['Wir lernen zusammen und lesen ein Buch.', 'de'],
    ['Die Bücher sind schön.', 'de'],
    ['Hola, quiero aprender español.', 'es'],
    ['Somos una familia muy feliz.', 'es'],
    ['¡Buenos días! ¿Cómo estás?', 'es'],
    ['Je suis avec vous.', 'fr'],
    ['Bonjour, je voudrais un café.', 'fr'],
    ['I would like to read a book.', 'en'],
    ['오늘 책을 읽고 있어요.', 'ko'],
    ['私は本を読んでいます。', 'ja'],
    ['我每天认真学习。', 'zh'],
  ] as const
  for (const [sentence, expected] of cases) assert.equal(detectLanguage(sentence), expected, sentence)
})
