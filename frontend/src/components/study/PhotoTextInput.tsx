import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { CameraIcon, ImageIcon, KeyboardIcon } from '@phosphor-icons/react'
import { AlertDialog, ConfirmDialog, Modal } from '../ui/Dialog'
import { extractImageText } from '../../services/ocr'
import ImageCropper from './ImageCropper'
import './PhotoTextInput.css'

export default function PhotoTextInput({ hasText, disabled, onApply, children, controls }: { hasText: boolean; disabled: boolean; onApply: (text: string) => void; children: ReactNode; controls: ReactNode }) {
  const [mode, setMode] = useState<'text' | 'camera' | 'image'>('text')
  const cameraRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const controller = useRef<AbortController | null>(null)
  const [file, setFile] = useState<File>()
  const [originalFile, setOriginalFile] = useState<File>()
  const [cropping, setCropping] = useState(false)
  const [preview, setPreview] = useState('')
  const [result, setResult] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  useEffect(() => () => controller.current?.abort(), [])

  const close = () => {
    controller.current?.abort()
    controller.current = null
    setLoading(false)
    setFile(undefined)
    setOriginalFile(undefined)
    setCropping(false)
    setPreview('')
    setResult(undefined)
    setConfirm(false)
  }
  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0]
    event.target.value = ''
    if (!selected) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || selected.size > 10 * 1024 * 1024) {
      setError('10MB 이하의 JPEG, PNG, WebP 사진을 선택해 주세요.')
      return
    }
    setResult(undefined)
    setPreview(URL.createObjectURL(selected))
    setFile(selected)
    setOriginalFile(selected)
    setCropping(true)
  }
  const extract = async () => {
    if (!file || cropping || controller.current) return
    const current = new AbortController()
    controller.current = current
    setLoading(true)
    try {
      const text = await extractImageText(file, current.signal)
      if (!current.signal.aborted) setResult(text)
    } catch (cause) {
      if (!current.signal.aborted) setError(cause instanceof Error ? cause.message : '글자 추출을 완료하지 못했습니다.')
    } finally {
      if (controller.current === current) {
        controller.current = null
        setLoading(false)
      }
    }
  }
  const apply = () => {
    if (!result?.trim() || result.length > 500) return
    setMode('text')
    onApply(result.trim())
    close()
  }
  return <>
    <div className="study-input-methods" role="group" aria-label="학습 내용 입력 방법">
      <button type="button" aria-pressed={mode === 'text'} disabled={disabled} onClick={() => setMode('text')}><KeyboardIcon weight={mode === 'text' ? 'fill' : 'regular'}/><span>직접 입력</span></button>
      <button type="button" aria-pressed={mode === 'camera'} disabled={disabled} onClick={() => { setMode('camera'); cameraRef.current?.click() }}><CameraIcon weight={mode === 'camera' ? 'fill' : 'regular'}/><span>사진 촬영</span></button>
      <button type="button" aria-pressed={mode === 'image'} disabled={disabled} onClick={() => { setMode('image'); uploadRef.current?.click() }}><ImageIcon weight={mode === 'image' ? 'fill' : 'regular'}/><span>이미지 선택</span></button>
    </div>
    <input hidden ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={choose}/>
    <input hidden ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={choose}/>
    {controls}
    <div className="study-input-body">
      {mode === 'text' ? children : <div className="study-photo-prompt">
        <button type="button" className="study-photo-prompt-icon" disabled={disabled} aria-label={mode === 'camera' ? '카메라 열기' : '이미지 선택하기'} onClick={() => (mode === 'camera' ? cameraRef : uploadRef).current?.click()}>{mode === 'camera' ? <CameraIcon aria-hidden="true"/> : <ImageIcon aria-hidden="true"/>}</button>
        <strong>{mode === 'camera' ? '학습하고 싶은 글을 찍어 주세요' : <>학습하고 싶은 글이 있는<br/>이미지를 선택해주세요</>}</strong>
      </div>}
    </div>
    <Modal open={Boolean(file) && !confirm && !error} title={cropping ? '사진 자르기' : result === undefined ? '사진에서 글자 추출' : '추출한 글 확인'} onClose={close} footer={<><button className="ui-dialog-secondary" onClick={close}>취소</button>{cropping ? null : result === undefined ? <button className="ui-dialog-primary" disabled={loading} onClick={() => void extract()}>{loading ? '글자 추출 중...' : '글자 추출'}</button> : <button className="ui-dialog-primary" disabled={!result.trim() || result.length > 500} onClick={() => hasText ? setConfirm(true) : apply()}>입력창에 적용</button>}</>}>
      <div className="photo-text-content">
        {cropping && originalFile ? <ImageCropper file={originalFile} onComplete={cropped => {
          setFile(cropped)
          setPreview(URL.createObjectURL(cropped))
          setCropping(false)
        }} onError={message => { close(); setError(message) }}/> : <>
          {preview && <img src={preview} alt="글자를 추출할 사진"/>}
          {result === undefined && <button type="button" className="ui-dialog-secondary ui-dialog-action" disabled={loading} onClick={() => setCropping(true)}>다시 자르기</button>}
        </>}
        {result !== undefined && <><label htmlFor="ocr-result">학습할 부분을 남기고 잘못 인식된 글자를 수정해 주세요.</label><textarea id="ocr-result" value={result} onChange={event => setResult(event.target.value)}/><p role="status">{result.length} / 500자{result.length > 500 ? ' · 500자 이내로 줄여 주세요.' : ''}</p></>}
        {loading && <p role="status">사진에서 글자를 읽고 있어요.</p>}
      </div>
    </Modal>
    <ConfirmDialog open={confirm} title="입력한 문장을 교체할까요?" message="현재 입력창의 문장을 추출한 글로 교체합니다." confirmLabel="교체" onConfirm={apply} onCancel={() => setConfirm(false)}/>
    <AlertDialog open={Boolean(error)} title="사진 추출 안내" message={error} tone="warning" onClose={() => setError('')}/>
  </>
}
