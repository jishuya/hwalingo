import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { CameraIcon, ImageIcon, CropIcon, InfoIcon, LightbulbIcon } from '@phosphor-icons/react'
import { AlertDialog, ConfirmDialog, Modal } from '../ui/Dialog'
import { extractImageText, type OcrResult } from '../../services/ocr'
import { tidyOcrWhitespace } from '../../utils/tidyOcrWhitespace'
import ImageCropper from './ImageCropper'
import PhotoZoomViewer from './PhotoZoomViewer'
import './PhotoTextInput.css'

export default function PhotoTextInput({ hasText, disabled, onApply, children, controls, characterCount }: { hasText: boolean; disabled: boolean; onApply: (text: string) => void; children: ReactNode; controls: ReactNode; characterCount: number }) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const controller = useRef<AbortController | null>(null)
  const [file, setFile] = useState<File>()
  const [originalFile, setOriginalFile] = useState<File>()
  const [cropping, setCropping] = useState(false)
  const [preview, setPreview] = useState('')
  const [result, setResult] = useState<string | undefined>()
  const [metadata, setMetadata] = useState<OcrResult>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [editNotice, setEditNotice] = useState('')

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
    setMetadata(undefined)
    setEditNotice('')
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
    setMetadata(undefined)
    setEditNotice('')
    setPreview(URL.createObjectURL(selected))
    setFile(selected)
    setOriginalFile(selected)
    setCropping(true)
  }
  const extract = async (selected: File) => {
    if (controller.current) return
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
    const current = new AbortController()
    controller.current = current
    setLoading(true)
    try {
      const response = await extractImageText(selected, current.signal)
      if (!current.signal.aborted) {
        setResult(response.text)
        setMetadata(response)
        setCropping(false)
      }
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
    onApply(result.trim())
    close()
  }
  const flashEditButton = (button: HTMLButtonElement) => {
    setEditNotice('')
    button.getAnimations().forEach(animation => animation.cancel())
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    button.animate([
      { backgroundColor: '#a7f3d0', borderColor: '#0cba87', color: '#007f61', boxShadow: '0 0 10px #0cba8755', transform: reducedMotion ? 'none' : 'scale(.96)' },
      { backgroundColor: '#ffffff', borderColor: '#e0e7e3', color: '#52635a', boxShadow: '0 0 0 transparent', transform: 'scale(1)' },
    ], { duration: reducedMotion ? 150 : 450, easing: 'ease-out' })
  }
  const copyText = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result)
    } catch {
      setEditNotice('복사하지 못했어요. 텍스트를 선택해 직접 복사해 주세요.')
    }
  }
  return <>
    <input hidden ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={choose}/>
    <input hidden ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={choose}/>
    {controls}
    <div className="study-input-body">
      {children}
      <div className="study-input-toolbar">
      <div className="study-photo-actions" role="group" aria-label="사진에서 글자 가져오기">
        <button type="button" aria-label="사진 촬영" title="사진 촬영" disabled={disabled} onClick={() => cameraRef.current?.click()}><CameraIcon weight="duotone" aria-hidden="true"/></button>
        <button type="button" aria-label="이미지 선택" title="이미지 선택" disabled={disabled} onClick={() => uploadRef.current?.click()}><ImageIcon weight="duotone" aria-hidden="true"/></button>
      </div>
      <span className="study-text-count" aria-label="입력 글자 수">{characterCount} / 500자</span>
      </div>
    </div>
    <Modal open={Boolean(file) && !confirm && !error} title={cropping ? '사진 자르기' : '추출한 글 확인'} titleBadge={<span className="photo-crop-smart-badge">{cropping ? 'AI OCR' : 'OCR 정밀인식'}</span>} description={cropping ? '인식할 문장이 상자 안에 오도록 조절해 주세요.' : undefined} onClose={close} footer={cropping ? undefined : <><button className="ui-dialog-secondary" onClick={close}>취소</button><button className="ui-dialog-primary" disabled={!result?.trim() || result.length > 500} onClick={() => hasText ? setConfirm(true) : apply()}>입력창에 적용</button></>}>
      <div className="photo-text-content">
        {cropping && originalFile ? <ImageCropper file={originalFile} extracting={loading} onComplete={extract} onError={message => { close(); setError(message) }}/> : <>
          {preview && <PhotoZoomViewer key={preview} src={preview} completed={result !== undefined}/>}
          <button type="button" className="ui-dialog-secondary ui-dialog-action photo-ocr-recrop" onClick={() => { setResult(undefined); setMetadata(undefined); setEditNotice(''); setCropping(true) }}><CropIcon aria-hidden="true"/>영역 다시 자르기</button>
        </>}
        {cropping && <button type="button" className="photo-crop-reselect" disabled={loading} onClick={() => { close(); uploadRef.current?.click() }}>다른 사진 선택하기</button>}
        {result !== undefined && <>
          <label className="photo-ocr-edit-label" htmlFor="ocr-result"><InfoIcon weight="fill" aria-hidden="true"/>학습할 부분만 남기고 잘못 인식된 글자를 수정해 주세요.</label>
          <div className="photo-ocr-editor">
            <textarea id="ocr-result" value={result} aria-describedby="ocr-character-count ocr-edit-notice" onChange={event => { setResult(event.target.value); setEditNotice('') }}/>
            <div className="photo-ocr-editor-footer">
              <div className="photo-ocr-editor-actions" role="group" aria-label="추출한 글 편집">
                <button type="button" disabled={!result} onClick={event => { flashEditButton(event.currentTarget); setResult(tidyOcrWhitespace(result)) }}><span className="photo-ocr-action-emoji" aria-hidden="true">🧹</span>공백 정리</button>
                <button type="button" disabled={!result} onClick={event => { flashEditButton(event.currentTarget); void copyText() }}><span className="photo-ocr-action-emoji" aria-hidden="true">📋</span>복사</button>
                <button type="button" disabled={!metadata || result === metadata.text} onClick={() => { if (metadata) { setResult(metadata.text); setEditNotice('처음 추출한 원문으로 복원했어요.') } }}><span className="photo-ocr-action-symbol" aria-hidden="true">↺</span>원문 복원</button>
              </div>
              <span id="ocr-character-count" className={result.length > 500 ? 'photo-ocr-count over-limit' : 'photo-ocr-count'}><strong>{result.length}</strong> / 500자</span>
            </div>
          </div>
          <p id="ocr-edit-notice" className="photo-ocr-edit-notice" role="status">{result.length > 500 ? '입력창에 적용하려면 500자 이내로 줄여 주세요.' : editNotice}</p>
          <div className="photo-ocr-edit-tip"><LightbulbIcon weight="fill" aria-hidden="true"/><p>불필요한 문장 기호나 머리말을 지우면 더 정확하게 번역 및 분석됩니다.</p></div>

        </>}
        {loading && <p role="status">사진에서 글자를 읽고 있어요.</p>}
      </div>
    </Modal>
    <ConfirmDialog open={confirm} title="입력한 문장을 교체할까요?" message="현재 입력창의 문장을 추출한 글로 교체합니다." confirmLabel="교체" onConfirm={apply} onCancel={() => setConfirm(false)}/>
    <AlertDialog open={Boolean(error)} title="사진 추출 안내" message={error} tone="warning" onClose={() => setError('')}/>
  </>
}
