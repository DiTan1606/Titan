import { motion } from 'motion/react'
import { useId } from 'react'
import { BILLS, type BillCounts } from '../lib/bills'

// Cùng tông xanh ngọc với thẻ VCB (V13-16) cho đồng bộ hai tab
const LEATHER = {
  back: '#0B5C48', // brand-700
  inside: '#04342C', // brand-900
  front: '#168A66', // brand-500
  rim: '#1D9E75', // brand-400
  stitch: '#9FE1CB', // brand-200
  tab: '#0F6E56', // brand-600
  snap: '#F6E2A8', // vàng như chip thẻ
}

/**
 * Chiếc ví da mở kiểu hoạt hình, bên trong là các tờ tiền đang có (mỗi mệnh giá một tờ, kèm ×số tờ).
 * Tờ tiền trồi lên TỪ TRONG ví (bị cắt ở miệng ví), không xuyên qua đáy ví. Ví trống → hiện ví rỗng.
 */
export function OpenWallet({ counts, className }: { counts: BillCounts; className?: string }) {
  const clip = useId()
  const bills = BILLS.filter((b) => (counts[b.value] ?? 0) > 0).slice(0, 6)
  const n = bills.length
  const spread = n > 1 ? Math.min(64, 13 * (n - 1)) : 0

  return (
    <svg viewBox="0 10 320 236" className={className} role="img" aria-label={n ? 'Ví tiền mặt' : 'Ví trống'}>
      <defs>
        {/* Chỉ thấy phần tờ tiền nằm trên đáy lòng ví */}
        <clipPath id={clip}>
          <rect x="0" y="0" width="320" height="200" />
        </clipPath>
      </defs>

      <ellipse cx="160" cy="238" rx="128" ry="7" fill="#000" fillOpacity="0.08" />

      {/* Mặt sau + lòng ví */}
      <rect x="40" y="58" width="240" height="166" rx="26" fill={LEATHER.back} />
      <rect x="54" y="70" width="212" height="140" rx="18" fill={LEATHER.inside} />

      {/* Tờ tiền cắm dọc, xòe như quạt bài quanh một điểm dưới đáy ví */}
      <g clipPath={`url(#${clip})`}>
        {bills.map((b, i) => {
          const angle = n > 1 ? -spread / 2 + (spread * i) / (n - 1) : 0
          return (
            <motion.g
              key={b.value}
              initial={{ y: 120 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.08 * i, type: 'spring', damping: 15, stiffness: 170 }}
            >
              <g transform={`translate(160 236) rotate(${angle}) translate(-34 -196)`}>
                <rect width="68" height="160" rx="7" fill={b.bg} stroke={b.fg} strokeWidth="2.5" />
                <rect x="5" y="5" width="58" height="150" rx="4" fill="none" stroke={b.fg} strokeOpacity="0.35" strokeWidth="1.5" />
                <circle cx="34" cy="70" r="16" fill={b.fg} fillOpacity="0.15" />
                <text x="7" y="23" fill={b.fg} fontSize="13.5" fontWeight="800" fontFamily="inherit">
                  {b.label}
                </text>
                <text x="7" y="39" fill={b.fg} fontSize="12" fontWeight="800" fontFamily="inherit" fillOpacity="0.8">
                  ×{counts[b.value]}
                </text>
              </g>
            </motion.g>
          )
        })}
      </g>

      {/* Ngăn trước */}
      <path d="M30 126 Q160 108 290 126 L286 210 Q286 234 262 234 L58 234 Q34 234 34 210 Z" fill={LEATHER.front} />
      <path d="M30 126 Q160 108 290 126" stroke={LEATHER.rim} strokeWidth="7" fill="none" strokeLinecap="round" />
      <path
        d="M46 138 Q160 122 274 138 L271 206 Q271 220 257 220 L63 220 Q49 220 49 206 Z"
        fill="none"
        stroke={LEATHER.stitch}
        strokeWidth="2"
        strokeDasharray="6 5"
        strokeOpacity="0.75"
      />
      {/* vệt sáng trên da */}
      <path d="M62 150 Q70 142 92 140" stroke="#fff" strokeOpacity="0.18" strokeWidth="5" fill="none" strokeLinecap="round" />

      {/* Quai cài nút */}
      <rect x="138" y="114" width="44" height="34" rx="11" fill={LEATHER.tab} />
      <circle cx="160" cy="133" r="6" fill={LEATHER.snap} stroke="#C9A24B" strokeWidth="2" />

      {n === 0 && (
        <text x="160" y="190" textAnchor="middle" fill="#C2ECDD" fontSize="16" fontWeight="800" fontFamily="inherit">
          Ví trống trơn
        </text>
      )}
    </svg>
  )
}
