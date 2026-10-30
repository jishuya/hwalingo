import { useEffect, useRef, useState } from 'react'
import { SpeakerHighIcon } from '@phosphor-icons/react'
import './SpeechControls.css'

const rates = [0.75, 1, 1.5, 2]

export default function SpeechControls({ rate, onRateChange, onPlay, playLabel = '문장 발음 듣기' }: { rate: number; onRateChange: (rate: number) => void; onPlay: () => void; playLabel?: string }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return <div className="sentence-speech-control" ref={rootRef} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }}>
    <div className="speech-rate-picker">
    <button type="button" className="speech-rate-trigger" ref={triggerRef} aria-label={`읽기 속도 ${rate}배, 속도 선택`} aria-expanded={open} onClick={() => setOpen(current => !current)}>{rate === 1 || rate === 2 ? rate.toFixed(1) : rate}×</button>
    {open && <div className="speech-rate-menu" role="group" aria-label="음성 읽기 속도">
      {rates.map(value => <button type="button" key={value} aria-pressed={value === rate} onClick={() => {
        onRateChange(value)
        setOpen(false)
        triggerRef.current?.focus()
      }}><span>{value}×</span></button>)}
    </div>}
    </div>
    <button type="button" className="speech-play-button" aria-label={playLabel} title={playLabel} onClick={onPlay}><SpeakerHighIcon weight="regular" aria-hidden="true"/></button>
  </div>
}
