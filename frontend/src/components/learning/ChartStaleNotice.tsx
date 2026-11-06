import { CloudSlashIcon } from '@phosphor-icons/react'
import './ChartStaleNotice.css'

export default function ChartStaleNotice() {
  return <div className="report-chart-stale" role="status">
    <span className="report-chart-stale-icon" aria-hidden="true"><CloudSlashIcon weight="duotone"/></span>
    <div><strong>최신 기록을 불러오지 못했어요</strong><p>마지막으로 확인한 기록을 표시하고 있어요.</p></div>
  </div>
}
