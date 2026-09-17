import { AlertTriangle, LoaderCircle, Trash2, X } from 'lucide-react'
import type { SecureFile } from '../types/file'

type DeleteModalProps = {
  file: SecureFile | null
  isDeleting: boolean
  onClose: () => void
  onConfirm: () => void
}

function DeleteModal({ file, isDeleting, onClose, onConfirm }: DeleteModalProps) {
  if (!file) return null

  return (
    <div className="modal-layer">
      <button
        type="button"
        aria-label="Close delete dialog"
        onClick={() => !isDeleting && onClose()}
        className="modal-backdrop"
      />

      <section className="modal-card delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
        <header className="modal-header compact">
          <div />
          <button type="button" disabled={isDeleting} onClick={onClose} className="icon-button" aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <div className="delete-content">
          <div className="danger-icon"><AlertTriangle size={24} /></div>
          <h2 id="delete-title">Delete encrypted file?</h2>
          <p>This permanently removes the encrypted object from your local vault.</p>
          <div className="delete-file"><strong>{file.name}</strong><span>Storage object will be removed</span></div>

          <div className="delete-actions">
            <button type="button" disabled={isDeleting} onClick={onClose} className="secondary-action">Cancel</button>
            <button type="button" disabled={isDeleting} onClick={onConfirm} className="danger-action">
              {isDeleting ? <><LoaderCircle size={14} className="animate-spin" /> Deleting…</> : <><Trash2 size={14} /> Delete file</>}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default DeleteModal
