import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { CameraIcon, ImageIcon, CropIcon, SparkleIcon, LightningIcon, TextAaIcon, MagnifyingGlassPlusIcon, BroomIcon, CopyIcon, ArrowCounterClockwiseIcon, InfoIcon, LightbulbIcon } from '@phosphor-icons/react'
import { AlertDialog, ConfirmDialog, Modal } from '../ui/Dialog'
import { extractImageText, type OcrResult } from '../../services/ocr'
import { tidyOcrWhitespace } from '../../utils/tidyOcrWhitespace'
import ImageCropper from './ImageCropper'
import './PhotoTextInput.css'

export default function PhotoTextInput({ hasText, disabled, onApply, children, controls }: { hasText: boolean; disabled: boolean; onApply: (text: string) => void; children: ReactNode; controls: ReactNode }) {
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
  const [previewOpen, setPreviewOpen] = useState(false)
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
    setPreviewOpen(false)
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
  const extract = async () => {
    if (!file || cropping || controller.current) return
    const current = new AbortController()
    controller.current = current
    setLoading(true)
    try {
      const response = await extractImageText(file, current.signal)
      if (!current.signal.aborted) {
        setResult(response.text)
        setMetadata(response)
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
  const copyText = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result)
      setEditNotice('텍스트를 복사했어요.')
    } catch {
      setEditNotice('복사하지 못했어요. 텍스트를 선택해 직접 복사해 주세요.')
    }
  }
  const languageNames = new Intl.DisplayNames(['ko'], { type: 'language' })
  const flags: Record<string, string> = { ko: '🇰🇷', en: '🇺🇸', ja: '🇯🇵', zh: '🇨🇳', fr: '🇫🇷', de: '🇩🇪', es: '🇪🇸' }
  const languageLabel = (code: string) => {
    try { return languageNames.of(code) ?? code } catch { return code }
  }
  return <>
    <input hidden ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={choose}/>
    <input hidden ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={choose}/>
    {controls}
    <div className="study-input-body">
      {children}
      <div className="study-photo-actions" role="group" aria-label="사진에서 글자 가져오기">
        <button type="button" aria-label="사진 촬영" title="사진 촬영" disabled={disabled} onClick={() => cameraRef.current?.click()}><CameraIcon weight="duotone" aria-hidden="true"/></button>
        <button type="button" aria-label="이미지 선택" title="이미지 선택" disabled={disabled} onClick={() => uploadRef.current?.click()}><ImageIcon weight="duotone" aria-hidden="true"/></button>
      </div>
    </div>
    <Modal open={Boolean(file) && !confirm && !error && !previewOpen} title={cropping ? '사진 자르기' : result === undefined ? '사진에서 글자 추출' : '추출한 글 확인'} description={result === undefined ? <span className="photo-crop-smart-badge">{cropping ? '스마트 OCR' : 'AI OCR'}</span> : <span className="photo-crop-smart-badge">OCR 정밀인식</span>} onClose={close} footer={cropping ? undefined : <><button className="ui-dialog-secondary" onClick={close}>취소</button>{cropping ? null : result === undefined ? <button className="ui-dialog-primary" disabled={loading} onClick={() => void extract()}><TextAaIcon size={18} aria-hidden="true"/> {loading ? '글자 추출 중...' : '글자 추출하기'}</button> : <button className="ui-dialog-primary" disabled={!result.trim() || result.length > 500} onClick={() => hasText ? setConfirm(true) : apply()}>입력창에 적용</button>}</>}>
      <div className="photo-text-content">
        {cropping && originalFile ? <ImageCropper file={originalFile} onComplete={cropped => {
          setFile(cropped)
          setPreview(URL.createObjectURL(cropped))
          setCropping(false)
        }} onError={message => { close(); setError(message) }}/> : <>
          {preview && <div className={`photo-ocr-preview${result !== undefined ? ' photo-ocr-preview-result' : ''}`}><img src={preview} alt="글자를 추출할 사진"/><button type="button" className="photo-ocr-zoom" aria-label="사진 확대 보기" onClick={() => setPreviewOpen(true)}><MagnifyingGlassPlusIcon aria-hidden="true"/></button>{result !== undefined && <span className="photo-ocr-complete-badge">AI 인식 완료</span>}</div>}
          {result === undefined && <button type="button" className="ui-dialog-secondary ui-dialog-action photo-ocr-recrop" disabled={loading} onClick={() => setCropping(true)}><CropIcon aria-hidden="true"/>영역 다시 자르기</button>}
          {result === undefined && <section className="photo-ocr-notice" aria-labelledby="photo-ocr-notice-title"><span className="photo-ocr-notice-icon"><SparkleIcon weight="fill" aria-hidden="true"/></span><div><h3 id="photo-ocr-notice-title">{loading ? '사진에서 텍스트를 읽고 있어요' : '스마트 텍스트 추출'}</h3><p>사진 속 글자를 추출해 AI 문장 학습과 해석에 활용해 보세요.</p><div className="photo-ocr-tags"><span><TextAaIcon aria-hidden="true"/>다국어 인식 지원</span><span><LightningIcon weight="fill" aria-hidden="true"/>{loading ? '추출 진행 중' : '추출 준비 완료'}</span></div></div></section>}
        </>}
        {cropping && <button type="button" className="photo-crop-reselect" onClick={() => { close(); uploadRef.current?.click() }}>다른 사진 선택하기</button>}
        {result !== undefined && <>
          <label className="photo-ocr-edit-label" htmlFor="ocr-result"><InfoIcon weight="fill" aria-hidden="true"/>학습할 부분을 남기고 오인식된 글자가 있다면 수정해 주세요.</label>
          <div className="photo-ocr-editor">
            <textarea id="ocr-result" value={result} aria-describedby="ocr-character-count ocr-edit-notice" onChange={event => { setResult(event.target.value); setEditNotice('') }}/>
            <div className="photo-ocr-editor-footer">
              <div className="photo-ocr-editor-actions" role="group" aria-label="추출한 글 편집">
                <button type="button" disabled={!result} onClick={() => { setResult(tidyOcrWhitespace(result)); setEditNotice('불필요한 공백을 정리했어요.') }}><BroomIcon aria-hidden="true"/>공백 정리</button>
                <button type="button" disabled={!result} onClick={() => void copyText()}><CopyIcon aria-hidden="true"/>복사</button>
                <button type="button" disabled={!metadata || result === metadata.text} onClick={() => { if (metadata) { setResult(metadata.text); setEditNotice('처음 추출한 원문으로 복원했어요.') } }}><ArrowCounterClockwiseIcon aria-hidden="true"/>원문 복원</button>
              </div>
              <span id="ocr-character-count" className={result.length > 500 ? 'photo-ocr-count over-limit' : 'photo-ocr-count'}><strong>{result.length}</strong> / 500자</span>
            </div>
          </div>
          <p id="ocr-edit-notice" className="photo-ocr-edit-notice" role="status">{result.length > 500 ? '입력창에 적용하려면 500자 이내로 줄여 주세요.' : editNotice}</p>
          <div className="photo-ocr-edit-tip"><LightbulbIcon weight="fill" aria-hidden="true"/><p>불필요한 문장 기호나 머리말을 지우면 더 정확하게 번역 및 분석됩니다.</p></div>
          <div className="photo-ocr-tags" aria-label="OCR 인식 정보"><span>{metadata?.confidence != null ? `인식 신뢰도 ${Math.round(metadata.confidence * 100)}%` : '인식 신뢰도 정보 없음'}</span>{metadata?.languages.length ? metadata.languages.map(language => <span key={language.code}><span aria-hidden="true">{flags[language.code.split('-')[0]] ?? '🌐'}</span>{languageLabel(language.code)} 감지</span>) : <span>감지 언어 정보 없음</span>}</div>
        </>}
        {loading && <p role="status">사진에서 글자를 읽고 있어요.</p>}
      </div>
    </Modal>
    <Modal open={previewOpen && Boolean(preview)} title="사진 확대 보기" size="large" onClose={() => setPreviewOpen(false)}><div className="photo-ocr-full-preview"><img src={preview} alt="글자를 추출할 사진 확대 보기"/></div></Modal>
    <ConfirmDialog open={confirm} title="입력한 문장을 교체할까요?" message="현재 입력창의 문장을 추출한 글로 교체합니다." confirmLabel="교체" onConfirm={apply} onCancel={() => setConfirm(false)}/>
    <AlertDialog open={Boolean(error)} title="사진 추출 안내" message={error} tone="warning" onClose={() => setError('')}/>
  </>
}
