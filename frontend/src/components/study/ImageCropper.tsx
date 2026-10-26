import { useEffect, useRef, useState, type PointerEvent } from 'react'

type Crop = { x: number; y: number; width: number; height: number }
type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move' | 'new'
const fullImage: Crop = { x: 0, y: 0, width: 100, height: 100 }
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export default function ImageCropper({ file, onComplete, onError }: { file: File; onComplete: (file: File) => void; onError: (message: string) => void }) {
  const [crop, setCrop] = useState<Crop>(fullImage)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const image = useRef<HTMLImageElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const alive = useRef(true)
  const drag = useRef<{ handle: Handle; x: number; y: number; crop: Crop; pointerId: number } | null>(null)
  useEffect(() => {
    alive.current = true
    const url = URL.createObjectURL(file)
    if (image.current) image.current.src = url
    return () => { alive.current = false; URL.revokeObjectURL(url) }
  }, [file])

  const point = (event: PointerEvent) => {
    const bounds = stage.current!.getBoundingClientRect()
    return { x: clamp((event.clientX - bounds.left) / bounds.width * 100, 0, 100), y: clamp((event.clientY - bounds.top) / bounds.height * 100, 0, 100) }
  }
  const start = (event: PointerEvent<HTMLDivElement>) => {
    if (!ready || busy || drag.current || (event.pointerType === 'mouse' && event.button !== 0)) return
    const target = event.target as HTMLElement
    const handle = (target.dataset.handle ?? 'new') as Handle
    const p = point(event)
    drag.current = { handle, ...p, crop: { ...crop }, pointerId: event.pointerId }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    const p = point(event)
    const c = current.crop
    if (current.handle === 'move') {
      setCrop({ ...c, x: clamp(c.x + p.x - current.x, 0, 100 - c.width), y: clamp(c.y + p.y - current.y, 0, 100 - c.height) })
      return
    }
    const anchorX = current.handle === 'new' ? current.x : current.handle.includes('w') ? c.x + c.width : c.x
    const anchorY = current.handle === 'new' ? current.y : current.handle.includes('n') ? c.y + c.height : c.y
    setCrop({ x: Math.min(anchorX, p.x), y: Math.min(anchorY, p.y), width: Math.abs(anchorX - p.x), height: Math.abs(anchorY - p.y) })
  }
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
  }
  const complete = async () => {
    const img = image.current
    if (!img || !ready || busy || crop.width < 1 || crop.height < 1) return
    setBusy(true)
    try {
      const sx = Math.round(img.naturalWidth * crop.x / 100)
      const sy = Math.round(img.naturalHeight * crop.y / 100)
      const width = Math.min(img.naturalWidth - sx, Math.max(1, Math.round(img.naturalWidth * crop.width / 100)))
      const height = Math.min(img.naturalHeight - sy, Math.max(1, Math.round(img.naturalHeight * crop.height / 100)))
      const scale = Math.min(1, 4096 / Math.max(width, height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(width * scale))
      canvas.height = Math.max(1, Math.round(height * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('이미지를 자를 수 없습니다. 다른 브라우저에서 다시 시도해 주세요.')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(img, sx, sy, width, height, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('이미지 저장에 실패했습니다. 다시 시도해 주세요.')), 'image/jpeg', 0.92))
      if (blob.size > 10 * 1024 * 1024) throw new Error('선택한 이미지가 너무 큽니다. 영역을 더 작게 선택해 주세요.')
      if (alive.current) onComplete(new File([blob], 'cropped-photo.jpg', { type: 'image/jpeg' }))
    } catch (error) {
      if (alive.current) onError(error instanceof Error ? error.message : '이미지를 자르지 못했습니다.')
    } finally {
      if (alive.current) setBusy(false)
    }
  }
  return <div className="image-cropper">
    <p id="crop-instructions">모서리를 드래그해 읽을 부분만 선택하세요.</p>
    <div className="image-cropper-stage" ref={stage} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={() => { drag.current = null }}>
      <img ref={image} alt="자르기 영역을 선택할 원본 사진" draggable={false} onLoad={() => setReady(true)} onError={() => onError('사진을 열 수 없습니다. JPEG, PNG, WebP 사진을 다시 선택해 주세요.')}/>
      {ready && <div className="image-cropper-selection" data-handle="move" style={{ left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.width}%`, height: `${crop.height}%` }}>
        {(['nw', 'ne', 'sw', 'se'] as const).map(handle => <span key={handle} data-handle={handle} className={`image-cropper-handle image-cropper-${handle}`}/>)}
      </div>}
    </div>
    <details className="image-cropper-adjustments"><summary>영역 미세 조절</summary>
    <fieldset disabled={!ready || busy} className="image-cropper-controls" aria-describedby="crop-instructions"><legend>자르기 영역 미세 조절</legend>
      {(['x', 'y', 'width', 'height'] as const).map(key => <label key={key}>{({ x: '왼쪽 위치', y: '위쪽 위치', width: '너비', height: '높이' })[key]}<input type="range" min="0" max={key === 'x' ? 100 - crop.width : key === 'y' ? 100 - crop.height : key === 'width' ? 100 - crop.x : 100 - crop.y} step="0.1" value={crop[key]} onChange={event => setCrop(current => ({ ...current, [key]: Number(event.target.value) }))}/></label>)}
    </fieldset></details>
    <div className="image-cropper-buttons"><button type="button" className="ui-dialog-secondary ui-dialog-action" disabled={busy} onClick={() => setCrop(fullImage)}>선택 초기화</button><button type="button" className="ui-dialog-secondary ui-dialog-action" disabled={busy || !ready} onClick={() => onComplete(file)}>전체 이미지 사용</button><button type="button" className="ui-dialog-primary ui-dialog-action" disabled={!ready || busy || crop.width < 1 || crop.height < 1} onClick={() => void complete()}>{busy ? '이미지 자르는 중...' : '선택 영역 사용'}</button></div>
  </div>
}
