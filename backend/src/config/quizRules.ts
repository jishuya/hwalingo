export const QUIZ_RULES = {
  defaultQuestionCount: 10,
  minimumVocabularyCount: 10,
  maxQuestionCount: 40,
  selectionWeights: {
    due: 0.5,
    new: 0.5,
    mastered: 0,
    weak: 0,
  },
  multipleChoiceMaxLevel: 2,
  recallMaxLevel: 4,
  choiceCount: 4,
} as const

export type SelectionGroup = keyof typeof QUIZ_RULES.selectionWeights | 'fallback'
export type QuestionType = 'multiple_choice' | 'recall' | 'context' | 'translation'
