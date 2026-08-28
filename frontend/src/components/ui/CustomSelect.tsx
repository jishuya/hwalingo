import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'

export interface CustomSelectOption {
  value: string
  label: string
}

interface CustomSelectProps {
  value: string
  options: CustomSelectOption[]
  onChange: (value: string) => void
  ariaLabel: string
}

export default function CustomSelect({ value, options, onChange, ariaLabel }: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value))

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const choose = (nextValue: string) => {
    onChange(nextValue)
    setOpen(false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(current => !current)
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const direction = event.key === 'ArrowDown' ? 1 : -1
    const nextIndex = (selectedIndex + direction + options.length) % options.length
    choose(options[nextIndex].value)
  }

  return <div ref={rootRef} className={`custom-select${open ? ' open' : ''}`}>
    <button type="button" className="custom-select-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(current => !current)} onKeyDown={handleKeyDown}>
      <span>{options[selectedIndex]?.label}</span><CaretDownIcon weight="bold"/>
    </button>
    {open && <div id={listId} className="custom-select-options" role="listbox" aria-label={ariaLabel}>
      {options.map(option => { const selected = option.value === value; return <button key={option.value} type="button" role="option" aria-selected={selected} className={selected ? 'selected' : ''} onClick={() => choose(option.value)}><span>{option.label}</span>{selected && <CheckIcon weight="bold"/>}</button> })}
    </div>}
  </div>
}
