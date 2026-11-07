import { createContext, useContext } from 'react'

export type ToastTone = 'default' | 'success' | 'error'
export type ShowToast = (text: string, opts?: { tone?: ToastTone; undo?: () => void }) => void

export const ToastContext = createContext<ShowToast>(() => {})

/** Hiện thông báo nhỏ: toast('Đã lưu', { tone: 'success', undo }) */
export const useToast = () => useContext(ToastContext)
