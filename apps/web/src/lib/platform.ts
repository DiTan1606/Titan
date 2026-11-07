// Nhận biết nền tảng chạy app

/** Đang mở bằng Safari trên iPhone (chưa thêm vào màn hình chính) */
export function isIosSafari() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  return ios && !standalone
}

/**
 * Safari iOS 26 trở lên: thanh dưới mới, nút Chia sẻ nằm trong nút ba chấm (•••) góc phải.
 * iOS cũ hơn: nút Chia sẻ ở giữa thanh dưới. (Safari ghi phiên bản thật ở "Version/xx", phần "OS 18_x" bị Apple đóng băng.)
 * `?install=26` / `?install=18` để xem trước trên máy tính.
 */
export function safariMajor(ua = navigator.userAgent, search = window.location.search): number {
  const forced = Number(new URLSearchParams(search).get('install'))
  if (forced > 1) return forced
  return Number(/Version\/(\d+)/.exec(ua)?.[1] ?? 0)
}
