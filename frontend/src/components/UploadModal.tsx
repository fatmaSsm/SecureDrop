import { useRef, useState } from 'react'
import {
  Check,
  FileText,
  LockKeyhole,
  ShieldCheck,
  UploadCloud,
  X,
} from 'lucide-react'

import { uploadFile } from '../services/api'

type UploadModalProps = {
  isOpen: boolean
  onClose: () => void
  onUploadSuccess?: (filename: string) => void
  onUploadError?: (message: string) => void
}

type UploadState = 'idle' | 'selected' | 'uploading' | 'success' | 'error'

const MAX_FILE_SIZE = 100 * 1024 * 1024

function UploadModal({
  isOpen,
  onClose,
  onUploadSuccess,
  onUploadError,
}: UploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const selectFile = (file: File) => {
    setErrorMessage('')

    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null)
      setUploadState('error')
      setErrorMessage('This file is larger than the 100 MB upload limit.')
      return
    }

    setSelectedFile(file)
    setUploadState('selected')
  }

  const reset = () => {
    setSelectedFile(null)
    setUploadState('idle')
    setErrorMessage('')
    setIsDragging(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const close = () => {
    if (uploadState === 'uploading') return
    reset()
    onClose()
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploadState('uploading')
    setErrorMessage('')

    try {
      await uploadFile(selectedFile)
      setUploadState('success')
      onUploadSuccess?.(selectedFile.name)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not upload this file.'
      setUploadState('error')
      setErrorMessage(message)
      onUploadError?.(message)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-layer">
      <button type="button" aria-label="Close upload dialog" onClick={close} className="modal-backdrop" />

      <section className="modal-card upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-title">
        <header className="modal-header">
          <div>
            <h2 id="upload-title">Secure upload</h2>
            <p>Encrypt a file before it is written to local storage.</p>
          </div>
          <button type="button" onClick={close} disabled={uploadState === 'uploading'} className="icon-button" aria-label="Close">
            <X size={16} />
          </button>
        </header>

        {uploadState === 'success' ? (
          <div className="upload-result">
            <div className="success-shield"><ShieldCheck size={28} /><span><Check size={11} /></span></div>
            <h3>File secured</h3>
            <p><strong>{selectedFile?.name}</strong> is encrypted and now stored in your vault.</p>
            <div className="security-pill"><LockKeyhole size={12} /> AES-256-GCM protected</div>
            <button type="button" onClick={close} className="primary-action">Return to vault</button>
          </div>
        ) : uploadState === 'uploading' ? (
          <div className="upload-result">
            <div className="encrypting-shield"><ShieldCheck size={27} /></div>
            <h3>Encrypting your file</h3>
            <p>SecureDrop is packaging metadata and file content before storage.</p>
            <div className="indeterminate-track"><div /></div>
            <span className="small-note">Keep this window open until the upload finishes.</span>
          </div>
        ) : (
          <div className="modal-body">
            <div
              className={`drop-zone ${isDragging ? 'dragging' : ''} ${selectedFile ? 'selected' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click()
              }}
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={(event) => {
                event.preventDefault()
                setIsDragging(false)
              }}
              onDrop={(event) => {
                event.preventDefault()
                setIsDragging(false)
                const file = event.dataTransfer.files?.[0]
                if (file) selectFile(file)
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) selectFile(file)
                }}
              />

              {selectedFile ? (
                <>
                  <div className="drop-icon"><FileText size={21} /></div>
                  <strong>{selectedFile.name}</strong>
                  <span>{formatFileSize(selectedFile.size)}</span>
                  <small>Click or drop another file to replace it.</small>
                </>
              ) : (
                <>
                  <div className="drop-icon"><UploadCloud size={21} /></div>
                  <strong>{isDragging ? 'Release to add the file' : 'Drop a file here'}</strong>
                  <span>or click to browse your computer</span>
                  <small>Maximum file size · 100 MB</small>
                </>
              )}
            </div>

            {errorMessage && <div className="inline-error">{errorMessage}</div>}

            <div className="upload-facts">
              <div><LockKeyhole size={14} /><span><strong>AES-256-GCM</strong><small>Authenticated encryption</small></span></div>
              <div><ShieldCheck size={14} /><span><strong>Metadata included</strong><small>Filename is encrypted at rest</small></span></div>
            </div>

            {selectedFile && (
              <button type="button" onClick={handleUpload} className="primary-action full-width">
                <LockKeyhole size={14} /> Encrypt & upload
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default UploadModal
