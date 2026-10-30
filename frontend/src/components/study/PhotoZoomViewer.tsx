import { useRef, useState, type PointerEvent } from 'react'
import { MinusIcon, MagnifyingGlassPlusIcon, ArrowCounterClockwiseIcon } from '@phosphor-icons/react'

export default function PhotoZoomViewer({ src, completed = false }: { src: string; completed?: boolean }) {
  const [zoom, setZoom] = useState(100)
  const viewport = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const reset = () => {
    setZoom(100)
    viewport.current?.scrollTo({ left: 0, top: 0 })
  }
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || zoom === 100) return
    drag.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }
  return <div className={`photo-zoom-viewer${completed ? ' photo-zoom-result' : ''}`}>
    <div className="photo-zoom-controls" role="group" aria-label="사진 확대 조절">
      {zoom > 100 && <><button type="button" aria-label="사진 축소" onClick={() => setZoom(current => Math.max(100, current - 50))}><MinusIcon aria-hidden="true"/></button><output aria-live="polite">{zoom}%</output><button type="button" aria-label="확대 배율 초기화" onClick={reset}><ArrowCounterClockwiseIcon aria-hidden="true"/></button></>}
      <button type="button" aria-label="사진 확대" disabled={zoom === 400} onClick={() => setZoom(current => Math.min(400, current + 50))}><MagnifyingGlassPlusIcon aria-hidden="true"/></button>
    </div>
    <div ref={viewport} className="photo-zoom-viewport" tabIndex={0} role="region" aria-label="사진 미리보기. 확대 후 스크롤하거나 손가락으로 밀어서 이동할 수 있습니다."
      onPointerDown={startDrag} onPointerMove={event => { if (drag.current) { event.currentTarget.scrollLeft = drag.current.left + drag.current.x - event.clientX; event.currentTarget.scrollTop = drag.current.top + drag.current.y - event.clientY } }} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }}>
      <div className="photo-zoom-image" style={{ width: `${zoom}%`, height: `${zoom}%`, cursor: zoom > 100 ? 'grab' : 'default' }}><img src={src} alt="글자를 추출할 사진" draggable={false}/></div>
    </div>
    {completed && <span className="photo-ocr-complete-badge">AI 인식 완료</span>}
  </div>
}
