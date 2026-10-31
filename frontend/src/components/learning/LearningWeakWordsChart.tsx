import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowClockwiseIcon, CaretRightIcon, TargetIcon } from '@phosphor-icons/react'
import { getVocabularies } from '../../services/vocabulary'
import { rankWeakWords } from '../../domain/weakWords'
import { languageOptions } from '../../services/analysis'
import { Modal } from '../ui/Dialog'
import './LearningWeakWordsChart.css'

export default function LearningWeakWordsChart({ onStart }: { onStart: () => void }) {
  const query = useQuery({ queryKey: ['vocabularies'], queryFn: () => getVocabularies(), refetchInterval: 20_000 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const words = query.data ?? []
  const ranked = rankWeakWords(words)
  const selected = words.find(word => word.vocabularyId === selectedId)
  const maximum = Math.max(1, ...ranked.map(word => word.progress.incorrectCount))
  const weakCount = words.filter(word => word.progress.incorrectCount > 0 && word.progress.totalAttempts > 0).length

  return <section className="card learning-weak-card" aria-labelledby="learning-weak-title">
    <div className="learning-weak-heading"><div><span className="learning-weak-eyebrow"><TargetIcon weight="duotone"/> 한 번 더 기억해볼까요?</span><h2 id="learning-weak-title">자주 틀리는 단어 TOP 5</h2><p>누적 기록 · 현재 보관 중인 단어 기준</p></div><button type="button" className="learning-weak-refresh" aria-label="자주 틀리는 단어 새로고침" disabled={query.isFetching} onClick={() => void query.refetch()}><ArrowClockwiseIcon/>새로고침</button></div>
    {query.isPending ? <p role="status">오답 기록을 불러오는 중이에요.</p>
      : query.isError && !query.data ? <div role="alert"><p>오답 기록을 불러오지 못했어요.</p><button type="button" className="primary" onClick={() => void query.refetch()}>다시 시도</button></div>
        : query.data && <>
          {ranked.length ? <ol className="learning-weak-ranking">{ranked.map((word, index) => {
            const { incorrectCount, totalAttempts } = word.progress
            const rate = Math.round(incorrectCount / totalAttempts * 100)
            return <li key={word.vocabularyId}><button type="button" onClick={() => setSelectedId(word.vocabularyId)} aria-label={`${index + 1}위 ${word.word}, 첫 답안 ${totalAttempts}회 중 오답 ${incorrectCount}회, 오답률 ${rate}%, 단어 상세 보기`}><span className="learning-weak-rank">{index + 1}</span><span className="learning-weak-copy"><span className="learning-weak-word"><b>{word.word}</b><small>{languageOptions.find(language => language.code === word.languageCode)?.label ?? word.languageCode}</small><CaretRightIcon/></span><span className="learning-weak-meaning">{word.meaning}</span><span className="learning-weak-track" aria-hidden="true"><span style={{ width: `${incorrectCount / maximum * 100}%` }}/></span><span className="learning-weak-counts"><span>응답 {totalAttempts}회 중 <strong>오답 {incorrectCount}회</strong></span><span>오답률 <strong>{rate}%</strong></span></span>{totalAttempts < 3 && <small className="learning-weak-sample">응답 기록이 아직 적어요.</small>}</span></button></li>
          })}</ol> : <div className="learning-weak-empty"><TargetIcon weight="duotone"/><h3>아직 오답 기록이 없어요</h3><p>테스트를 풀면 다시 공부할 단어를 모아드릴게요.</p></div>}
          <div className="learning-weak-action"><div><strong>오답 이력이 있는 단어 {weakCount.toLocaleString('ko-KR')}개</strong><p>테스트는 TOP 5를 포함한 전체 오답 단어를 대상으로 구성해요.</p></div><button type="button" className="primary" disabled={!weakCount} onClick={onStart}>오답 단어 테스트</button></div>
          <p className="learning-weak-note">오답 재도전을 제외한 첫 답안 기준이에요. 오답 횟수 → 오답률 → 마지막 학습이 오래된 순으로 정렬해요. 막대 길이는 오답 횟수의 상대 비교이며, 응답이 적으면 오답률이 크게 달라질 수 있어요.</p>
          {query.isError && <p className="learning-weak-note" role="status">최신 기록을 불러오지 못해 마지막으로 확인한 기록을 표시하고 있어요.</p>}
        </>}
    <Modal open={selectedId !== null} title={selected?.word ?? '단어 상세'} description="틀린 단어를 다시 확인해보세요." onClose={() => setSelectedId(null)} size="large">
      {selected ? <div className="learning-weak-detail"><p>{selected.meaning}</p>{selected.contextMeaning && selected.contextMeaning !== selected.meaning && <p>{selected.contextMeaning}</p>}<dl><div><dt>첫 답안 응답</dt><dd>{selected.progress.totalAttempts}회</dd></div><div><dt>첫 답안 오답</dt><dd>{selected.progress.incorrectCount}회</dd></div><div><dt>오답률</dt><dd>{Math.round(selected.progress.incorrectCount / selected.progress.totalAttempts * 100)}%</dd></div></dl>{selected.exampleSentence && <section><h3>예문</h3><p>{selected.exampleSentence}</p>{selected.exampleTranslation && <p>{selected.exampleTranslation}</p>}</section>}{selected.memoryTip && <section><h3>기억 팁</h3><p>{selected.memoryTip}</p></section>}</div> : <p>현재 보관 중인 단어를 찾지 못했어요.</p>}
    </Modal>
  </section>
}
