interface SummaryItem {
  label: string
  value: string | number
  unit?: string
  tone?: 'neutral' | 'green' | 'amber'
  title?: string
  onClick?: () => void
}

export default function ReportSummary({ items, className = '' }: { items: SummaryItem[]; className?: string }) {
  return <div className={`report-summary ${className}`} style={{ gridTemplateColumns: `repeat(${items.length},minmax(0,1fr))` }}>
    {items.map(item => {
      const content = <><span>{item.label}</span><strong>{item.value}{item.unit && <small>{item.unit}</small>}</strong></>
      const className = `report-summary-item tone-${item.tone ?? 'green'}`
      return item.onClick
        ? <button key={item.label} type="button" className={className} title={item.title} onClick={item.onClick} aria-label={`${item.label} ${item.value}${item.unit ?? ''}, 단어 목록 보기`}>{content}</button>
        : <div key={item.label} className={className} title={item.title}>{content}</div>
    })}
  </div>
}
