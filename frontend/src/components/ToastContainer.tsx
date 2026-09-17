import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import type { ToastData, ToastType } from '../types/toast'

type ToastContainerProps = {
  toasts: ToastData[]
  onRemove: (id: number) => void
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

function Toast({ toast, onRemove }: { toast: ToastData; onRemove: (id: number) => void }) {
  const appearance = getToastAppearance(toast.type)
  const Icon = appearance.icon

  return (
    <div className={`toast-card ${appearance.className}`}>
      <div className="toast-icon"><Icon size={16} /></div>
      <div className="toast-copy">
        <strong>{toast.title}</strong>
        {toast.message && <span>{toast.message}</span>}
      </div>
      <button type="button" onClick={() => onRemove(toast.id)} aria-label="Dismiss notification"><X size={13} /></button>
      <div className="toast-progress" />
    </div>
  )
}

function getToastAppearance(type: ToastType) {
  switch (type) {
    case 'success':
      return { icon: CheckCircle2, className: 'success' }
    case 'error':
      return { icon: AlertCircle, className: 'error' }
    case 'info':
      return { icon: Info, className: 'info' }
  }
}

export default ToastContainer
