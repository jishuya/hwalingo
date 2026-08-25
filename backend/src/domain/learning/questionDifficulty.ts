import { QUIZ_RULES, type QuestionType } from '../../config/quizRules.js'
import type { MasteryLevel } from '../../config/learningRules.js'

export function questionTypeForLevel(level: MasteryLevel, hasExampleSentence: boolean): QuestionType {
  if (level <= QUIZ_RULES.multipleChoiceMaxLevel) return 'multiple_choice'
  if (level <= QUIZ_RULES.recallMaxLevel || !hasExampleSentence) return 'recall'
  return 'context'
}
