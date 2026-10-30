import type { CSSProperties } from 'react'
import { ArrowClockwiseIcon, ArrowRightIcon, CheckCircleIcon, HouseIcon, SparkleIcon, TrophyIcon } from '@phosphor-icons/react'

interface QuizCompleteProps {
  mode?: 'standard' | 'incorrect'
  accuracy: number
  earnedXp: number
  relearnedCount: number
  onRestart: () => void
  onHome: () => void
}

const confettiColors = ['#008c44', '#69c49b', '#ffd95a', '#86b6ee', '#c3a1de']

export default function QuizComplete({ mode = 'standard', accuracy, earnedXp, relearnedCount, onRestart, onHome }: QuizCompleteProps) {
  return <div className="quiz-page page quiz-completion-page">
    <section className="card quiz-completion" aria-labelledby="quiz-completion-title">
      <div className="quiz-confetti" aria-hidden="true">
        {Array.from({ length: 48 }, (_, index) => {
          const side = index % 2 === 0 ? -1 : 1
          const style = {
            '--confetti-x': `${side * (35 + (index * 47) % 240)}px`,
            '--confetti-y': `${90 + (index * 37) % 240}px`,
            '--confetti-spin': `${side * (180 + (index * 53) % 540)}deg`,
            '--confetti-delay': `${(index % 8) * 65}ms`,
            background: confettiColors[index % confettiColors.length],
          } as CSSProperties
          return <i key={index} style={style}/>
        })}
      </div>
      <div className="quiz-completion-emblem" aria-hidden="true"><SparkleIcon className="quiz-completion-sparkle left" weight="fill"/><TrophyIcon weight="duotone"/><SparkleIcon className="quiz-completion-sparkle right" weight="fill"/></div>
      <span className="quiz-completion-eyebrow">차곡차곡 쌓이는 나의 실력</span>
      <h1 id="quiz-completion-title">{mode === 'incorrect' ? '오답 단어 테스트 완료!' : '오늘의 테스트 완료!'}</h1>
      <p className="quiz-completion-message">오늘도 한 걸음 성장했어요.<br/>꾸준히 쌓은 배움이 실력이 될 거예요.</p>
      <div className="quiz-completion-stats">
        <div><span>첫 시도 정답률</span><strong>{accuracy}<small>%</small></strong></div>
        <div><span>획득한 경험치</span><strong>+{earnedXp}<small>XP</small></strong></div>
      </div>
      {relearnedCount > 0 && <p className="quiz-completion-relearned"><CheckCircleIcon weight="fill" aria-hidden="true"/>오답 {relearnedCount}개도 모두 다시 익혔어요!</p>}
      <div className="quiz-completion-actions">
        <button type="button" className="quiz-completion-restart" onClick={onRestart}><ArrowClockwiseIcon aria-hidden="true"/>새 테스트<ArrowRightIcon aria-hidden="true"/></button>
        <button type="button" className="quiz-completion-home" onClick={onHome}><HouseIcon aria-hidden="true"/>홈으로</button>
      </div>
    </section>
  </div>
}
