import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, SlidersHorizontal } from 'lucide-react'

export type SortMode = 'name' | 'size-desc' | 'size-asc' | 'type'

type Props = { value: SortMode; onChange: (value: SortMode) => void }

const options: Array<{ value: SortMode; label: string; hint: string }> = [
  { value: 'name', label: 'Name', hint: 'A to Z' },
  { value: 'size-desc', label: 'Largest first', hint: 'Size descending' },
  { value: 'size-asc', label: 'Smallest first', hint: 'Size ascending' },
  { value: 'type', label: 'File type', hint: 'Group by format' },
]

export default function SortDropdown({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    const closeEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => {
      document.removeEventListener('mousedown', closeOutside)
      document.removeEventListener('keydown', closeEscape)
    }
  }, [])

  return (
    <div className="sort-dropdown" ref={rootRef}>
      <button type="button" className={`sort-trigger ${open ? 'open' : ''}`} onClick={() => setOpen((current) => !current)} aria-haspopup="listbox" aria-expanded={open}>
        <SlidersHorizontal size={15} />
        <span>{selected.label}</span>
        <ChevronDown size={15} className="sort-chevron" />
      </button>
      {open && (
        <div className="sort-menu" role="listbox" aria-label="Sort files">
          <div className="sort-menu-title">Sort files by</div>
          {options.map((option) => {
            const active = option.value === value
            return (
              <button key={option.value} type="button" role="option" aria-selected={active} className={`sort-option ${active ? 'active' : ''}`} onClick={() => { onChange(option.value); setOpen(false) }}>
                <span><strong>{option.label}</strong><small>{option.hint}</small></span>
                <span className="sort-check">{active && <Check size={14} />}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
