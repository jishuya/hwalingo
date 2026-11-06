import ChartStaleNotice from './ChartStaleNotice'
import ChartErrorState from './ChartErrorState'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowCounterClockwiseIcon, CaretRightIcon, TrendUpIcon } from '@phosphor-icons/react'
import { getGrowingWords } from '../../services/progress'
import { getVocabularies } from '../../services/vocabulary'
import { masteryStageNames } from '../../domain/masteryStages'
import { Modal } from '../ui/Dialog'
import VocabularyWordCard from '../vocabulary/VocabularyWordCard'
import './LearningWeakWordsChart.css'
import './LearningWordGrowthChart.css'

export default function LearningWordGrowthChart() {
  const query = useQuery({ queryKey: ['progress', 'word-growth'], queryFn: getGrowingWords, refetchInterval: 20_000 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const wordsQuery = useQuery({ queryKey: ['vocabularies'], queryFn: () => getVocabularies(), enabled: selectedId !== null })
  const selected = wordsQuery.data?.find(word => word.vocabularyId === selectedId)
  return <section className="card learning-weak-card learning-word-growth-card" aria-labelledby="word-growth-title">
    <div className="learning-weak-heading report-chart-heading"><div><h2 id="word-growth-title"><TrendUpIcon weight="duotone" aria-hidden="true"/> 최근 성장한 단어 TOP 5</h2></div><button type="button" className="learning-weak-refresh report-chart-refresh" aria-label="최근 성장한 단어 새로고침" disabled={query.isFetching} onClick={() => void query.refetch()}><ArrowCounterClockwiseIcon weight="regular" aria-hidden="true"/></button></div>
    <p className="report-ranking-description">오늘 포함 최근 30일 · 숙련도 순상승 기준 (한국 시간)</p>
    {query.isPending ? <p role="status">단어 성장 기록을 불러오는 중이에요.</p>
      : query.isError && !query.data ? <ChartErrorState message="단어 성장 기록을 불러오지 못했어요." retrying={query.isFetching} onRetry={() => void query.refetch()}/>
      : query.data && <>
        {query.data.words.length ? <ol className="learning-weak-ranking">{query.data.words.map((word, index) => <li key={word.vocabularyId}>
          <button type="button" onClick={() => setSelectedId(word.vocabularyId)} aria-label={`${index + 1}위 ${word.word}, ${word.beforeLevel}단계에서 ${word.currentLevel}단계로 ${word.gained}단계 상승, 단어 상세 보기`}>
            <span className="learning-weak-rank">{index + 1}</span><span className="learning-weak-copy">
              <span className="learning-weak-word"><b>{word.word}</b><small>{word.languageCode.toUpperCase()}</small><CaretRightIcon aria-hidden="true"/></span>
              <span className="learning-weak-meaning">{word.meaning}</span>
              <span className="learning-weak-track" aria-hidden="true"><span style={{ width: `${word.gained / 7 * 100}%` }}/></span>
              <span className="learning-weak-counts"><span>Lv.{word.beforeLevel} {masteryStageNames[word.beforeLevel]} → Lv.{word.currentLevel} {masteryStageNames[word.currentLevel]}</span><strong>+{word.gained}단계</strong></span>
            </span>
          </button>
        </li>)}</ol> : <div className="learning-weak-empty"><TrendUpIcon aria-hidden="true"/><h3>앞으로의 성장을 기다리고 있어요</h3><p>복습하며 숙련도가 오르면 여기에 보여드려요.</p></div>}
        {query.isError && <ChartStaleNotice/>}
      </>}
    <Modal open={selectedId !== null} title="단어 상세" onClose={() => setSelectedId(null)} size="large">
      {wordsQuery.isPending ? <p role="status">단어를 불러오는 중이에요.</p> : wordsQuery.isError ? <div role="alert"><p>단어를 불러오지 못했어요.</p><button type="button" onClick={() => void wordsQuery.refetch()}>다시 시도</button></div> : selected ? <div className="vocabulary-page"><VocabularyWordCard key={selected.vocabularyId} word={selected} expanded/></div> : <p>현재 보관 중인 단어를 찾지 못했어요.</p>}
    </Modal>
  </section>
}
