/**
 * V13-14 · Bàn phím iPhone trượt đè lên trang, không đẩy trang lên.
 * iOS cuộn cả trang để ô nhập không bị che khi bàn phím bật. Trang đã cố định (index.css), nên mỗi khi
 * iOS dịch trang đi thì kéo về vị trí cũ. Bảng nhập liệu (Sheet) toàn màn hình, nội dung ở trên, bàn phím đè phần dưới.
 */
export function lockPageScroll() {
  const reset = () => {
    if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0)
  }
  const soon = () => {
    reset()
    requestAnimationFrame(reset)
    // iOS cuộn sau khi bàn phím trượt xong (~300ms)
    setTimeout(reset, 120)
    setTimeout(reset, 350)
  }
  window.addEventListener('scroll', reset, { passive: true })
  document.addEventListener('focusin', soon)
  window.visualViewport?.addEventListener('resize', soon)
  window.visualViewport?.addEventListener('scroll', reset)
}
