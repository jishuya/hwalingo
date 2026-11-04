import { masteryStageNames } from '../../domain/masteryStages'
import ReportSummary from './ReportSummary'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowCounterClockwiseIcon, CaretRightIcon, PlantIcon, InfoIcon, ClockIcon } from '@phosphor-icons/react'
import { getUserProgress } from '../../services/progress'
import { getVocabularies } from '../../services/vocabulary'
import { languageOptions } from '../../services/analysis'
import { Modal } from '../ui/Dialog'
import './LearningMasteryChart.css'

const stages = masteryStageNames
const reviewIntervals = [0,1,3,7,14,30,60,120]
const stageDescriptions = [
  '처음 저장했거나 다시 익혀야 하는 단어예요.',
  '기억하기 시작했어요. 정답으로 도달하면 1일 뒤 복습해요.',
  '짧은 시간 동안 기억할 수 있어요. 정답으로 도달하면 3일 뒤 복습해요.',
  '여러 번 만나 익숙해졌어요. 정답으로 도달하면 7일 뒤 복습해요.',
  '오래 기억하는 단계로 들어가요. 정답으로 도달하면 14일 뒤 복습해요.',
  '기억이 안정적으로 쌓였어요. 정답으로 도달하면 30일 뒤 복습해요.',
  '꾸준한 복습으로 마스터했어요. 정답으로 도달하면 60일 뒤 복습해요.',
  '가장 높은 숙련도예요. 정답으로 도달하면 120일 뒤 복습해요.',
]
const number = (value: number) => value.toLocaleString('ko-KR')

export default function LearningMasteryChart() {
  const query = useQuery({ queryKey: ['progress', 'me'], queryFn: getUserProgress })
  const [helpOpen, setHelpOpen] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null)
  const wordsQuery = useQuery({ queryKey: ['vocabularies'], queryFn: () => getVocabularies(), enabled: selectedLevel !== null })
  const distribution = stages.map((name, level) => ({ name, level, count: query.data?.masteryDistribution.find(item => item.masteryLevel === level)?.wordCount ?? 0 }))
  const total = distribution.reduce((sum, item) => sum + item.count, 0)
  const mastered = distribution.filter(item => item.level >= 6).reduce((sum, item) => sum + item.count, 0)
  const words = (wordsQuery.data ?? []).filter(word => word.progress.masteryLevel === selectedLevel)
  const selectedStage = selectedLevel !== null ? stages[selectedLevel] : ''

  return <section className="card learning-mastery-card" aria-labelledby="learning-mastery-title">
    <div className="learning-mastery-heading report-chart-heading"><div><h2 id="learning-mastery-title"><PlantIcon weight="duotone" aria-hidden="true"/> 숙련도 분포</h2></div><div className="report-chart-actions"><button type="button" className="report-chart-refresh" aria-label="숙련도 단계 안내" title="숙련도 단계 안내" aria-haspopup="dialog" onClick={()=>setHelpOpen(true)}><InfoIcon weight="regular" aria-hidden="true"/></button><button type="button" className="learning-mastery-refresh report-chart-refresh" aria-label="숙련도 분포 새로고침" disabled={query.isFetching} onClick={() => void query.refetch()}><ArrowCounterClockwiseIcon weight="regular" aria-hidden="true"/></button></div></div>
    {query.isPending ? <p role="status">숙련도를 불러오는 중이에요.</p>
      : query.isError && !query.data ? <div role="alert"><p>숙련도를 불러오지 못했어요.</p><button className="primary" type="button" onClick={() => void query.refetch()}>다시 시도</button></div>
        : query.data && <>
          <ReportSummary className="learning-mastery-summary" items={[
            {label:'보관 단어',value:number(total),unit:'개'},
            {label:'마스터한 단어',value:number(mastered),unit:'개',tone:'amber',title:`6~7단계 · 전체의 ${total ? (mastered/total*100).toFixed(1) : '0'}%`},
          ]}/>

          <div className="learning-mastery-rows" role="group" aria-label="0~7단계 숙련도별 단어 수와 전체 단어 중 비중">{distribution.map(item => {
            const percent = total ? item.count / total * 100 : 0
            return <button type="button" key={item.level} className={item.level >= 6 ? 'mastered' : ''} aria-label={`${item.level}단계 ${item.name}, ${item.count}개, 전체의 ${percent.toFixed(1)}%, 단어 목록 보기`} onClick={() => setSelectedLevel(item.level)}><span className="learning-mastery-row-title"><span><small className="learning-mastery-stage">lv.{item.level}</small><b>{item.name}</b></span><span><strong>{number(item.count)}개</strong><small>{percent.toFixed(1)}%</small><CaretRightIcon weight="bold"/></span></span><span className="learning-mastery-track" aria-hidden="true"><span style={{ width: `${percent}%` }}/></span></button>
          })}</div>

          {query.isError && <p role="status">최신 기록을 불러오지 못해 마지막으로 확인한 기록을 표시하고 있어요.</p>}
        </>}
    <Modal open={helpOpen} title="숙련도 단계 안내" titleBadge={<span className="mastery-guide-title-badge">망각곡선 주기</span>} description="lv.0~lv.7로 단어의 기억 정도를 알려줘요." onClose={()=>setHelpOpen(false)} presentation="overlay">
      <ol className="mastery-stage-guide">{stages.map((stage,level)=>{
        const interval = reviewIntervals[level]
        const description = stageDescriptions[level].split(`${interval}일`)
        return <li key={stage} className={`mastery-guide-card mastery-guide-level-${level}`}>
          <span className="mastery-guide-level" aria-hidden="true">{level}</span>
          <div className="mastery-guide-copy"><div className="mastery-guide-card-heading"><h3>Lv.{level} · {stage}</h3><span className="mastery-guide-interval">{level===0?'대기 중':<><ClockIcon aria-hidden="true"/>{interval}일 뒤 복습</>}</span></div>
            <p>{interval?<>{description[0]}<strong>{interval}일</strong>{description[1]}</>:stageDescriptions[level]}</p>
          </div>
        </li>
      })}</ol>
      <p className="mastery-guide-note">예정된 복습에서 정답이면 한 단계 올라가고, 오답이면 한 단계 내려가 더 빨리 복습해요. 예정일 전 정답은 단계를 올리지 않아요. 마스터한 단어도 복습이 필요해요.</p>
    </Modal>
    <Modal open={selectedLevel !== null} title={`${selectedStage} 단어`} description={stageDescriptions[selectedLevel ?? 0]} onClose={() => setSelectedLevel(null)} size="large">
      {wordsQuery.isPending ? <p role="status">단어를 불러오는 중이에요.</p>
        : wordsQuery.isError ? <div role="alert"><p>단어를 불러오지 못했어요.</p><button className="primary" type="button" onClick={() => void wordsQuery.refetch()}>다시 시도</button></div>
          : <><p className="learning-mastery-word-count">총 {number(words.length)}개</p>{words.length ? <ul className="learning-mastery-words">{words.map(word => <li key={word.vocabularyId}><div><strong>{word.word}</strong><small className="report-word-language" aria-label={languageOptions.find(language=>language.code===word.languageCode)?.label??word.languageCode}>{word.languageCode.toUpperCase()}</small>{word.cefrLevel&&<small className={`report-word-cefr level-${word.cefrLevel.toLowerCase()}`} aria-label={`CEFR ${word.cefrLevel}`}>{word.cefrLevel}</small>}</div><p>{word.meaning}</p></li>)}</ul> : <p>현재 이 단계에 있는 단어가 없어요.</p>}</>}
    </Modal>
  </section>
}
