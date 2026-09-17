export type ToastType =
  | 'success'
  | 'error'
  | 'info'

export interface ToastData {
  id: number
  type: ToastType
  title: string
  message?: string
}