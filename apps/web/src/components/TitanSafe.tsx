import { motion } from 'motion/react'
import { useId } from 'react'

export type SafeMood = 'idle' | 'happy' | 'wow'

/**
 * V14 · Linh vật Titan: chiếc két sắt làm bằng titan (xám bạc ánh xanh, vân xước kim loại),
 * mặt trước là cửa két có đôi mắt, má hồng, núm xoay mật mã và tay nắm. Lơ lửng nhẹ như ví / thẻ VCB.
 */
export function TitanSafe(props: { size?: number; mood?: SafeMood; float?: boolean; className?: string }) {
  const size = props.size ?? 120
  const mood = props.mood ?? 'idle'
  const id = useId().replace(/:/g, '')
  const g = (n: string) => `${n}-${id}`

  return (
    <motion.div
      className={props.className}
      style={{ width: size, height: size * 1.08 }}
      animate={props.float === false ? undefined : { y: [0, -5, 0], rotate: [-1.5, 1.5, -1.5] }}
      transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
    >
      <svg viewBox="0 0 200 216" width="100%" height="100%" role="img" aria-label="Linh vật két sắt Titan">
        <defs>
          {/* thân titan: xám bạc ánh xanh */}
          <linearGradient id={g('body')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#EEF2F5" />
            <stop offset="0.45" stopColor="#C3CCD4" />
            <stop offset="1" stopColor="#8B97A3" />
          </linearGradient>
          <linearGradient id={g('door')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#DCE3E9" />
            <stop offset="1" stopColor="#AAB5BF" />
          </linearGradient>
          <radialGradient id={g('dial')} cx="0.4" cy="0.35" r="0.7">
            <stop offset="0" stopColor="#F4F7F9" />
            <stop offset="0.6" stopColor="#A9B4BE" />
            <stop offset="1" stopColor="#6E7A86" />
          </radialGradient>
          {/* vân xước kim loại */}
          <pattern id={g('brush')} width="6" height="200" patternUnits="userSpaceOnUse" patternTransform="rotate(8)">
            <rect width="1" height="200" fill="#ffffff" opacity="0.18" />
          </pattern>
        </defs>

        {/* bóng đổ */}
        <ellipse cx="100" cy="208" rx="62" ry="6" fill="#000" opacity="0.12" />

        {/* chân */}
        <rect x="38" y="182" width="26" height="18" rx="6" fill="#6E7A86" />
        <rect x="136" y="182" width="26" height="18" rx="6" fill="#6E7A86" />

        {/* thân */}
        <rect x="18" y="14" width="164" height="174" rx="30" fill={`url(#${g('body')})`} stroke="#5E6A75" strokeWidth="4" />
        <rect x="18" y="14" width="164" height="174" rx="30" fill={`url(#${g('brush')})`} />
        {/* ánh sáng cạnh trên */}
        <path d="M44 22 H150 a24 24 0 0 1 20 12" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.7" />

        {/* bản lề */}
        <rect x="24" y="52" width="10" height="22" rx="4" fill="#7D8995" />
        <rect x="24" y="128" width="10" height="22" rx="4" fill="#7D8995" />

        {/* cửa két */}
        <rect x="38" y="34" width="124" height="134" rx="20" fill={`url(#${g('door')})`} stroke="#6E7A86" strokeWidth="3.5" />
        {/* đinh tán 4 góc */}
        {[
          [50, 46],
          [150, 46],
          [50, 156],
          [150, 156],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="3.2" fill="#7D8995" />
        ))}

        {/* mắt */}
        {mood === 'happy' ? (
          <>
            <path d="M66 82 q11 -12 22 0" fill="none" stroke="#1F2933" strokeWidth="6" strokeLinecap="round" />
            <path d="M112 82 q11 -12 22 0" fill="none" stroke="#1F2933" strokeWidth="6" strokeLinecap="round" />
          </>
        ) : (
          <>
            <ellipse cx="77" cy="80" rx={mood === 'wow' ? 11 : 10} ry={mood === 'wow' ? 13 : 12} fill="#1F2933" />
            <ellipse cx="123" cy="80" rx={mood === 'wow' ? 11 : 10} ry={mood === 'wow' ? 13 : 12} fill="#1F2933" />
            <circle cx="81" cy="75" r="3.6" fill="#fff" />
            <circle cx="127" cy="75" r="3.6" fill="#fff" />
            <circle cx="74" cy="86" r="1.6" fill="#fff" opacity="0.8" />
            <circle cx="120" cy="86" r="1.6" fill="#fff" opacity="0.8" />
          </>
        )}

        {/* má hồng */}
        <ellipse cx="62" cy="100" rx="9" ry="5.5" fill="#F4A3B4" opacity="0.75" />
        <ellipse cx="138" cy="100" rx="9" ry="5.5" fill="#F4A3B4" opacity="0.75" />

        {/* miệng */}
        {mood === 'wow' ? (
          <ellipse cx="100" cy="104" rx="7" ry="8" fill="#1F2933" />
        ) : (
          <path d="M90 99 q10 11 20 0" fill="none" stroke="#1F2933" strokeWidth="5" strokeLinecap="round" />
        )}

        {/* núm xoay mật mã */}
        <g transform="translate(100 140)">
          <circle r="19" fill={`url(#${g('dial')})`} stroke="#5E6A75" strokeWidth="3" />
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1="0" y1="-15" x2="0" y2={i % 3 === 0 ? -10 : -12.5} stroke="#4B5661" strokeWidth="1.6" transform={`rotate(${i * 30})`} />
          ))}
          <circle r="6" fill="#5E6A75" />
          <circle r="2.4" cx="-1.5" cy="-1.5" fill="#C3CCD4" />
        </g>

        {/* tay nắm */}
        <rect x="140" y="124" width="9" height="32" rx="4.5" fill="#5E6A75" />
        <rect x="142" y="126" width="3" height="20" rx="1.5" fill="#C3CCD4" opacity="0.8" />

        {/* chữ Ti khắc trên nóc (ký hiệu nguyên tố titan) */}
        <text x="100" y="31" textAnchor="middle" fontSize="11" fontWeight="800" fill="#5E6A75" fontFamily="ui-sans-serif, system-ui" opacity="0.85">
          Ti · 22
        </text>
      </svg>
    </motion.div>
  )
}
