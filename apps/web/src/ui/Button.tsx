import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'soft' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'btn-3d bg-brand-400 border-brand-600 text-white',
  secondary: 'btn-3d bg-white border-2 border-b-4 border-ink-200 text-ink-800',
  soft: 'btn-3d bg-brand-50 border-brand-200 text-brand-800',
  danger: 'btn-3d bg-white border-2 border-b-4 border-red-200 text-red-600',
  ghost: 'text-ink-600 active:bg-ink-100',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 rounded-xl px-3 text-sm',
  md: 'h-12 rounded-2xl px-4 text-[15px]',
  lg: 'h-14 rounded-2xl px-5 text-base',
}

/** Nút của Titan. primary = hành động chính (tối đa 1 nút / màn). */
export function Button({
  variant = 'secondary',
  size = 'md',
  full,
  caps = size !== 'sm',
  icon,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  full?: boolean
  /** VIẾT HOA kiểu Duolingo — dùng cho nút ngắn; nút có câu dài thì tắt */
  caps?: boolean
  icon?: ReactNode
}) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center gap-2 font-bold disabled:opacity-40 ${
        caps ? 'uppercase tracking-wide' : ''
      } ${VARIANTS[variant]} ${SIZES[size]} ${full ? 'w-full' : ''} ${className}`}
    >
      {icon}
      {children}
    </button>
  )
}
