import { ArrowClockwiseIcon, FileTextIcon, WarningCircleIcon } from '@phosphor-icons/react'
import './ChartErrorState.css'

interface ChartErrorStateProps {
  message: string
  retrying: boolean
  onRetry: () => void
}

export default function ChartErrorState({message,retrying,onRetry}:ChartErrorStateProps) {
  return <div className="report-chart-error" role="alert" aria-busy={retrying}>
    <span className="report-chart-error-icon" aria-hidden="true"><FileTextIcon weight="duotone"/><WarningCircleIcon weight="fill"/></span>
    <h3>{message}</h3>
    <p>연결 상태를 확인한 뒤<br/>버튼을 눌러 다시 시도해 주세요.</p>
    <button type="button" onClick={onRetry} disabled={retrying}><ArrowClockwiseIcon weight="bold" aria-hidden="true"/>{retrying?'다시 불러오는 중…':'다시 시도'}</button>
  </div>
}
