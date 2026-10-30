import { X } from '@phosphor-icons/react'

export default function DialogCloseButton({ onClose, label }: { onClose: () => void; label: string }) {
  return <button type="button" className="ui-dialog-close" onClick={onClose} aria-label={label}><X weight="bold"/></button>
}
