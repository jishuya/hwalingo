import { CheckCircle, Question, Warning, X } from '@phosphor-icons/react'
import { useEffect, useEffectEvent, useId, useRef, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type DialogTone = 'success' | 'info' | 'warning' | 'danger'
type DialogSize = 'small' | 'medium' | 'large'

interface ModalProps {
  open: boolean
  title: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  onClose: () => void
  closeOnBackdrop?: boolean
  size?: DialogSize
  ariaLabel?: string
  role?: 'dialog' | 'alertdialog'
  presentation?: 'sheet' | 'compact'
  icon?: ReactNode
  hideClose?: boolean
  tone?: DialogTone
}

export function Modal({ open, title, description, children, footer, onClose, closeOnBackdrop = true, size = 'medium', ariaLabel, role = 'dialog', presentation = 'sheet', icon, hideClose = false, tone = 'info' }: ModalProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const closeDialog = useEffectEvent(onClose)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusTimer = window.setTimeout(() => {
      const preferred = dialogRef.current?.querySelector<HTMLElement>('[autofocus], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
      preferred?.focus()
    })
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDialog()
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [open])

  if (!open) return null

  const handleBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && event.target === event.currentTarget) onClose()
  }

  return createPortal(<div
    className={`ui-dialog-backdrop ui-dialog-backdrop-${presentation}`}
    style={{
      position: 'fixed',
      inset: 0,
      width: '100vw',
      height: '100dvh',
      display: 'flex',
      alignItems: presentation === 'sheet' ? 'flex-end' : 'center',
      justifyContent: 'center',
    }}
    onMouseDown={handleBackdrop}
  >
    <section ref={dialogRef} className={`ui-dialog ui-dialog-${size} ui-dialog-${presentation} ui-dialog-${tone}`} role={role} aria-modal="true" aria-labelledby={ariaLabel ? undefined : titleId} aria-label={ariaLabel} aria-describedby={description ? descriptionId : undefined}>
      {presentation === 'sheet' && <div className="ui-dialog-handle" aria-hidden="true"><span/></div>}
      <header className="ui-dialog-header">
        <div>{icon && <span className="ui-dialog-heading-icon">{icon}</span>}<h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div>
        {!hideClose && <button type="button" onClick={onClose} aria-label={`${title} 닫기`}><X weight="bold"/></button>}
      </header>
      {children && <div className="ui-dialog-body">{children}</div>}
      {footer && <footer className="ui-dialog-footer">{footer}</footer>}
    </section>
  </div>, document.body)
}

interface AlertDialogProps {
  open: boolean
  title: string
  message: ReactNode
  onClose: () => void
  confirmLabel?: string
  tone?: Exclude<DialogTone, 'danger'>
  icon?: ReactNode
}

export function AlertDialog({ open, title, message, onClose, confirmLabel = '확인', tone = 'info', icon }: AlertDialogProps) {
  const DefaultIcon = tone === 'success' ? CheckCircle : tone === 'warning' ? Warning : Question
  return <Modal open={open} title={title} description={message} icon={icon ?? <DefaultIcon weight="fill"/>} tone={tone} onClose={onClose} size="small" role="alertdialog" presentation="compact" hideClose closeOnBackdrop={false} footer={<button className="ui-dialog-primary" type="button" onClick={onClose} autoFocus>{confirmLabel}</button>}/>
}

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: ReactNode
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  loading?: boolean
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmLabel = '확인', cancelLabel = '취소', tone = 'default', loading = false }: ConfirmDialogProps) {
  const Icon = tone === 'danger' ? Warning : Question
  return <Modal open={open} title={title} description={message} icon={<Icon/>} tone={tone === 'danger' ? 'danger' : 'info'} onClose={onCancel} size="small" role="alertdialog" presentation="compact" hideClose closeOnBackdrop={false} footer={<><button className="ui-dialog-secondary" type="button" onClick={onCancel} disabled={loading}>{cancelLabel}</button><button className="ui-dialog-primary" type="button" onClick={onConfirm} disabled={loading} autoFocus>{loading ? '처리 중...' : confirmLabel}</button></>}/>
}
