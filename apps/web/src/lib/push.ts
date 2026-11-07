import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export type PushSupport = 'supported' | 'needs-install' | 'unsupported'

/** iPhone chỉ cho Web Push khi app đã được "Thêm vào màn hình chính". */
export function getPushSupport(): PushSupport {
  const hasApis = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (isIos && !isStandalone) return 'needs-install'
  return hasApis ? 'supported' : 'unsupported'
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/** Lấy (hoặc tạo) đăng ký push của BẢN CÀI hiện tại và lưu lên server. Cần quyền đã được cấp. */
async function registerSubscription(): Promise<void> {
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidKey) throw new Error('Thiếu VITE_VAPID_PUBLIC_KEY')
  const registration = await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    }))
  const json = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
      user_agent: navigator.userAgent,
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}

/** Xin quyền rồi đăng ký. Gọi từ một thao tác bấm của người dùng (iOS bắt buộc). */
export async function enablePush(): Promise<void> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Bạn chưa cho phép thông báo')
  await registerSubscription()
}

/**
 * Gọi mỗi lần mở app: nếu đã cho phép thông báo thì đảm bảo bản cài hiện tại vẫn đăng ký trên server.
 * (Xóa icon rồi thêm lại vào màn hình chính = bản cài mới → đăng ký cũ mất hiệu lực.)
 */
export async function syncPushSubscription(): Promise<void> {
  if (getPushSupport() !== 'supported' || Notification.permission !== 'granted') return
  try {
    await registerSubscription()
  } catch (err) {
    console.warn('Không đăng ký lại được thông báo', err)
  }
}

export type PushState = 'loading' | 'on' | 'off' | 'denied' | 'needs-install' | 'unsupported'

/** Trạng thái thông báo của bản cài hiện tại, dùng cho banner và màn Cài đặt. */
export function usePushState() {
  const [state, setState] = useState<PushState>('loading')

  const refresh = useCallback(async () => {
    const support = getPushSupport()
    if (support !== 'supported') return setState(support)
    if (Notification.permission === 'denied') return setState('denied')
    if (Notification.permission !== 'granted') return setState('off')
    const registration = await navigator.serviceWorker.ready
    setState((await registration.pushManager.getSubscription()) ? 'on' : 'off')
  }, [])

  useEffect(() => {
    queueMicrotask(refresh) // đọc trạng thái sau khi render xong
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [refresh])

  const enable = useCallback(async () => {
    await enablePush()
    await refresh()
  }, [refresh])

  return { state, enable, refresh }
}

export async function sendTestPush(): Promise<{ sent: number; removed: number; failed: number }> {
  const { data, error } = await supabase.functions.invoke('push-test', { method: 'POST' })
  if (error) throw error
  return data
}
