import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowClockwiseIcon, CaretRightIcon, PlantIcon, TrophyIcon } from '@phosphor-icons/react'
import { getUserProgress } from '../../services/progress'
import { getVocabularies } from '../../services/vocabulary'
import { languageOptions } from '../../services/analysis'
import { Modal } from '../ui/Dialog'
import './LearningMasteryChart.css'

const stages = ['처음 만남', '기억 시작', '단기 기억', '익숙함', '장기 기억 진입', '장기 기억', '마스터', '완전 마스터']
const number = (value: number) => value.toLocaleString('ko-KR')

export default function LearningMasteryChart() {
  const query = useQuery({ queryKey: ['progress', 'me'], queryFn: getUserProgress })
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null)
  const wordsQuery = useQuery({ queryKey: ['vocabularies'], queryFn: () => getVocabularies(), enabled: selectedLevel !== null })
  const distribution = stages.map((name, level) => ({ name, level, count: query.data?.masteryDistribution.find(item => item.masteryLevel === level)?.wordCount ?? 0 }))
  const total = distribution.reduce((sum, item) => sum + item.count, 0)
  const mastered = distribution.filter(item => item.level >= 6).reduce((sum, item) => sum + item.count, 0)
  const words = (wordsQuery.data ?? []).filter(word => word.progress.masteryLevel === selectedLevel)
  const selectedStage = selectedLevel !== null ? stages[selectedLevel] : ''

  return <section className="card learning-mastery-card" aria-labelledby="learning-mastery-title">
    <div className="learning-mastery-heading"><div><span className="learning-mastery-eyebrow"><PlantIcon weight="duotone"/> 단어가 기억으로 자라는 과정</span><h2 id="learning-mastery-title">숙련도 분포</h2><p>현재 보관 중인 단어의 기억 단계예요.</p></div><button type="button" className="learning-mastery-refresh" aria-label="숙련도 분포 새로고침" disabled={query.isFetching} onClick={() => void query.refetch()}><ArrowClockwiseIcon/>새로고침</button></div>
    {query.isPending ? <p role="status">숙련도를 불러오는 중이에요.</p>
      : query.isError && !query.data ? <div role="alert"><p>숙련도를 불러오지 못했어요.</p><button className="primary" type="button" onClick={() => void query.refetch()}>다시 시도</button></div>
        : query.data && <>
          <div className="learning-mastery-summary"><div><span>보관 중인 단어</span><strong>{number(total)}<small>개</small></strong></div><div><span><TrophyIcon weight="duotone"/> 마스터 이상 · 6~7단계</span><strong>{number(mastered)}<small>개 · {total ? (mastered / total * 100).toFixed(1) : '0'}%</small></strong></div></div>
          <div className="learning-mastery-rows" role="group" aria-label="0~7단계 숙련도별 단어 수와 전체 단어 중 비중">{distribution.map(item => {
            const percent = total ? item.count / total * 100 : 0
            return <button type="button" key={item.level} className={item.level >= 6 ? 'mastered' : ''} aria-label={`${item.level}단계 ${item.name}, ${item.count}개, 전체의 ${percent.toFixed(1)}%, 단어 목록 보기`} onClick={() => setSelectedLevel(item.level)}><span className="learning-mastery-row-title"><span><small>{item.level}단계</small><b>{item.name}</b></span><span><strong>{number(item.count)}개</strong><small>{percent.toFixed(1)}%</small><CaretRightIcon weight="bold"/></span></span><span className="learning-mastery-track" aria-hidden="true"><span style={{ width: `${percent}%` }}/></span></button>
          })}</div>
          {!total && <p className="learning-mastery-note">단어를 저장하면 처음 만남 단계부터 이곳에 표시돼요.</p>}
          <p className="learning-mastery-note">막대를 누르면 해당 단계의 단어를 볼 수 있어요. 막대 길이는 전체 보관 단어 중 비중이며, 마스터는 6~7단계 기준이에요. 단어별 숙련도는 화랑이 레벨과 별개예요.</p>
          {query.isError && <p className="learning-mastery-note" role="status">최신 기록을 불러오지 못해 마지막으로 확인한 기록을 표시하고 있어요.</p>}
        </>}
    <Modal open={selectedLevel !== null} title={`${selectedStage} 단어`} description={`${selectedLevel ?? 0}단계에 있는 보관 단어예요.`} onClose={() => setSelectedLevel(null)} size="large">
      {wordsQuery.isPending ? <p role="status">단어를 불러오는 중이에요.</p>
        : wordsQuery.isError ? <div role="alert"><p>단어를 불러오지 못했어요.</p><button className="primary" type="button" onClick={() => void wordsQuery.refetch()}>다시 시도</button></div>
          : <><p className="learning-mastery-word-count">총 {number(words.length)}개</p>{words.length ? <ul className="learning-mastery-words">{words.map(word => <li key={word.vocabularyId}><div><strong>{word.word}</strong><span>{languageOptions.find(language => language.code === word.languageCode)?.label ?? word.languageCode}</span></div><p>{word.meaning}</p>{word.contextMeaning && word.contextMeaning !== word.meaning && <small>{word.contextMeaning}</small>}</li>)}</ul> : <p className="learning-mastery-note">현재 이 단계에 있는 단어가 없어요.</p>}</>}
    </Modal>
  </section>
}
