import { motion } from 'motion/react'
import { useId } from 'react'

/**
 * Nét mặt của Két (V14): hóm hỉnh, cà khịa chứ không dễ thương.
 * smirk: nhếch mép, một bên mày nhướn · laugh: cười hô hố · judge: liếc xéo phán xét · shock: há hốc
 */
export type SafeMood = 'smirk' | 'laugh' | 'judge' | 'shock'

/**
 * V14 · Linh vật Titan: "Két", chiếc két sắt bằng titan (xám bạc ánh xanh, vân xước kim loại).
 * Mặt trước là cửa két: mắt mí sụp, mày nhướn, miệng nhếch; núm xoay mật mã và tay nắm. Lơ lửng nhẹ.
 */
export function TitanSafe(props: { size?: number; mood?: SafeMood; float?: boolean; className?: string }) {
  const size = props.size ?? 120
  const mood = props.mood ?? 'smirk'
  const id = useId().replace(/:/g, '')
  const g = (n: string) => `${n}-${id}`
  const ink = '#1F2933'

  return (
    <motion.div
      className={props.className}
      style={{ width: size, height: size * 1.08 }}
      animate={props.float === false ? undefined : mood === 'laugh' ? { y: [0, -6, 0, -4, 0], rotate: [-3, 3, -3] } : { y: [0, -5, 0], rotate: [-1.5, 1.5, -1.5] }}
      transition={{ duration: mood === 'laugh' ? 1.2 : 3.6, repeat: Infinity, ease: 'easeInOut' }}
    >
      <svg viewBox="0 0 200 216" width="100%" height="100%" role="img" aria-label="Két, linh vật của Titan">
        <defs>
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
          <pattern id={g('brush')} width="6" height="200" patternUnits="userSpaceOnUse" patternTransform="rotate(8)">
            <rect width="1" height="200" fill="#ffffff" opacity="0.18" />
          </pattern>
        </defs>

        <ellipse cx="100" cy="208" rx="62" ry="6" fill="#000" opacity="0.12" />
        <rect x="38" y="182" width="26" height="18" rx="6" fill="#6E7A86" />
        <rect x="136" y="182" width="26" height="18" rx="6" fill="#6E7A86" />

        <rect x="18" y="14" width="164" height="174" rx="30" fill={`url(#${g('body')})`} stroke="#5E6A75" strokeWidth="4" />
        <rect x="18" y="14" width="164" height="174" rx="30" fill={`url(#${g('brush')})`} />
        <path d="M44 22 H150 a24 24 0 0 1 20 12" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
        <rect x="24" y="52" width="10" height="22" rx="4" fill="#7D8995" />
        <rect x="24" y="128" width="10" height="22" rx="4" fill="#7D8995" />

        <rect x="38" y="34" width="124" height="134" rx="20" fill={`url(#${g('door')})`} stroke="#6E7A86" strokeWidth="3.5" />
        {[
          [50, 46],
          [150, 46],
          [50, 156],
          [150, 156],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="3.2" fill="#7D8995" />
        ))}

        <Face mood={mood} ink={ink} lid={`url(#${g('door')})`} />

        {/* núm xoay mật mã */}
        <g transform="translate(100 142)">
          <circle r="18" fill={`url(#${g('dial')})`} stroke="#5E6A75" strokeWidth="3" />
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1="0" y1="-14" x2="0" y2={i % 3 === 0 ? -9 : -11.5} stroke="#4B5661" strokeWidth="1.6" transform={`rotate(${i * 30})`} />
          ))}
          <circle r="5.5" fill="#5E6A75" />
        </g>
        <rect x="140" y="126" width="9" height="32" rx="4.5" fill="#5E6A75" />
        <rect x="142" y="128" width="3" height="20" rx="1.5" fill="#C3CCD4" opacity="0.8" />
        <text x="100" y="31" textAnchor="middle" fontSize="11" fontWeight="800" fill="#5E6A75" fontFamily="ui-sans-serif, system-ui" opacity="0.85">
          Ti · 22
        </text>
      </svg>
    </motion.div>
  )
}

function Face({ mood, ink, lid }: { mood: SafeMood; ink: string; lid: string }) {
  if (mood === 'laugh')
    return (
      <g>
        {/* mày nhướn cao */}
        <path d="M62 62 q12 -9 26 -2" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />
        <path d="M112 60 q14 -7 26 2" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />
        {/* mắt nhắm tịt vì cười: > < */}
        <path d="M66 74 l14 7 l-14 7" fill="none" stroke={ink} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M134 74 l-14 7 l14 7" fill="none" stroke={ink} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* miệng há to cười hô hố */}
        <path d="M76 98 q24 4 48 0 q-4 24 -24 24 q-20 0 -24 -24z" fill={ink} />
        <path d="M86 112 q14 -6 28 0 q-6 9 -14 9 q-8 0 -14 -9z" fill="#E86A6A" />
        <path d="M80 99 h40" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      </g>
    )
  if (mood === 'shock')
    return (
      <g>
        <path d="M62 56 q12 -8 24 -4" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />
        <path d="M114 52 q12 -4 24 4" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />
        <circle cx="76" cy="80" r="13" fill="#fff" stroke={ink} strokeWidth="3.5" />
        <circle cx="124" cy="80" r="13" fill="#fff" stroke={ink} strokeWidth="3.5" />
        <circle cx="76" cy="80" r="4.5" fill={ink} />
        <circle cx="124" cy="80" r="4.5" fill={ink} />
        <ellipse cx="100" cy="112" rx="9" ry="11" fill={ink} />
      </g>
    )
  if (mood === 'judge')
    return (
      <g>
        {/* mày chau, liếc xéo */}
        <path d="M62 64 l26 6" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />
        <path d="M112 70 l26 -6" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />
        <Eye cx={76} pupil={-5} lidTo={0.55} ink={ink} lid={lid} />
        <Eye cx={124} pupil={-5} lidTo={0.55} ink={ink} lid={lid} />
        <path d="M86 108 q14 -4 28 2" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />
      </g>
    )
  // smirk: một bên mày nhướn, mí sụp, nhếch mép
  return (
    <g>
      <path d="M62 66 q12 -3 26 0" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />
      <path d="M112 62 q14 -10 26 -4" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />
      <Eye cx={76} pupil={3} lidTo={0.5} ink={ink} lid={lid} />
      <Eye cx={124} pupil={3} lidTo={0.3} ink={ink} lid={lid} />
      <path d="M84 106 q16 6 32 -8" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />
      <path d="M115 95 q4 2 3 6" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />
    </g>
  )
}

/** Mắt tròng trắng, con ngươi lệch (pupil), mí trên sụp xuống theo tỉ lệ lidTo (0 = mở hết, 1 = nhắm) */
function Eye(props: { cx: number; pupil: number; lidTo: number; ink: string; lid: string }) {
  const cy = 82
  const r = 11
  const lidY = cy - r + 2 * r * props.lidTo
  return (
    <g>
      <circle cx={props.cx} cy={cy} r={r} fill="#fff" stroke={props.ink} strokeWidth="3.5" />
      <circle cx={props.cx + props.pupil} cy={cy + 3} r="5" fill={props.ink} />
      <path d={`M${props.cx - r - 2} ${cy - r - 3} H${props.cx + r + 2} V${lidY} H${props.cx - r - 2}z`} fill={props.lid} />
      <path d={`M${props.cx - r - 1} ${lidY} H${props.cx + r + 1}`} stroke={props.ink} strokeWidth="4" strokeLinecap="round" />
    </g>
  )
}
