import { Moon, Sun } from 'lucide-react'

export type Theme = 'dark' | 'light'

type ThemeToggleProps = {
  theme: Theme
  onToggle: () => void
  compact?: boolean
}

function ThemeToggle({ theme, onToggle, compact = false }: ThemeToggleProps) {
  const Icon = theme === 'dark' ? Sun : Moon
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onToggle}
      className={`theme-toggle ${compact ? 'theme-toggle-compact' : ''}`}
    >
      <Icon size={15} />
      {!compact && <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>}
    </button>
  )
}

export default ThemeToggle
