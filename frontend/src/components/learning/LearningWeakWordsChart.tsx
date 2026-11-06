import ChartErrorState from './ChartErrorState'
import VocabularyWordCard from '../vocabulary/VocabularyWordCard'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowCounterClockwiseIcon, CaretRightIcon, TargetIcon } from '@phosphor-icons/react'
import { getVocabularies } from '../../services/vocabulary'
import LearningTimer from './LearningTimer'
import { rankWeakWords } from '../../domain/weakWords'
import { Modal } from '../ui/Dialog'
import './LearningWeakWordsChart.css'

export default function LearningWeakWordsChart({ onStart }: { onStart: () => void }) {
  const query = useQuery({ queryKey: ['vocabularies'], queryFn: () => getVocabularies(), refetchInterval: 20_000 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const words = query.data ?? []
  const ranked = rankWeakWords(words)
  const selected = words.find(word => word.vocabularyId === selectedId)
  const maximum = Math.max(1, ...ranked.map(word => word.progress.incorrectCount))
  const weakCount = words.filter(word => word.progress.incorrectCount > 0 && word.progress.totalAttempts > 0 && !word.incorrectPracticeExcluded).length

  return <section className="card learning-weak-card" aria-labelledby="learning-weak-title">
    <div className="learning-weak-heading report-chart-heading"><div><h2 id="learning-weak-title"><TargetIcon weight="duotone" aria-hidden="true"/> 자주 틀리는 단어 TOP 5</h2></div><button type="button" className="learning-weak-refresh report-chart-refresh" aria-label="자주 틀리는 단어 새로고침" disabled={query.isFetching} onClick={() => void query.refetch()}><ArrowCounterClockwiseIcon weight="regular" aria-hidden="true"/></button></div>
    <p className="report-ranking-description">전체 기간 누적 오답 기준 · 재도전 제외</p>
    {query.isPending ? <p role="status">오답 기록을 불러오는 중이에요.</p>
      : query.isError && !query.data ? <ChartErrorState message="오답 기록을 불러오지 못했어요." retrying={query.isFetching} onRetry={() => void query.refetch()}/>
        : query.data && <>
          {ranked.length ? <ol className="learning-weak-ranking">{ranked.map((word, index) => {
            const { incorrectCount, totalAttempts } = word.progress
            const rate = Math.round(incorrectCount / totalAttempts * 100)
            return <li key={word.vocabularyId}><button type="button" onClick={() => setSelectedId(word.vocabularyId)} aria-label={`${index + 1}위 ${word.word}, 첫 답안 ${totalAttempts}회 중 오답 ${incorrectCount}회, 오답률 ${rate}%, 단어 상세 보기`}><span className="learning-weak-rank">{index + 1}</span><span className="learning-weak-copy"><span className="learning-weak-word"><b>{word.word}</b><CaretRightIcon/></span><span className="learning-weak-meaning">{word.meaning}</span><span className="learning-weak-track" aria-hidden="true"><span style={{ width: `${incorrectCount / maximum * 100}%` }}/></span><span className="learning-weak-counts"><span>응답 {totalAttempts}회 중 <strong>오답 {incorrectCount}회</strong></span><span>오답률 <strong>{rate}%</strong></span></span>{totalAttempts < 3 && <small className="learning-weak-sample">응답 기록이 아직 적어요.</small>}</span></button></li>
          })}</ol> : <div className="learning-weak-empty"><TargetIcon weight="duotone" aria-hidden="true"/><h3>아직 오답 기록이 없어요</h3><p>테스트를 풀면 다시 공부할 단어를 모아드릴게요.</p></div>}
          <div className="learning-weak-action"><div><strong>오답 이력이 있는 단어 {weakCount.toLocaleString('ko-KR')}개</strong></div><button type="button" className="primary" disabled={!weakCount} onClick={onStart}>틀린단어 집중연습</button></div>

          {query.isError && <p role="status">최신 기록을 불러오지 못해 마지막으로 확인한 기록을 표시하고 있어요.</p>}
        </>}
    <Modal open={selectedId !== null} title="단어 상세" onClose={() => setSelectedId(null)} size="large">
      {selected ? <div className="vocabulary-page"><VocabularyWordCard key={selected.vocabularyId} word={selected} expanded
        />
        <LearningTimer activity="vocabulary" enabled/>
      </div> : <p>현재 보관 중인 단어를 찾지 못했어요.</p>}
    </Modal>
  </section>
}
