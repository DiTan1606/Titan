import { useQuery } from '@tanstack/react-query'
import { ChevronRight, LogOut, Pencil } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { TitanSafe } from '../../components/TitanSafe'
import { nicknameOf, useProfile } from '../../lib/data'
import { supabase } from '../../lib/supabase'
import { Button } from '../../ui/Button'
import { NicknameSheet } from './NicknameSheet'

/** V14 · Tab Profile: chữ cái đầu của tên làm ảnh đại diện, tên (bút chì để đổi), các thẻ khác bổ sung sau */
export function ProfileScreen(props: { onReplayIntro?: () => void }) {
  const profile = useProfile()
  const user = useQuery({ queryKey: ['auth-user'], queryFn: async () => (await supabase.auth.getUser()).data.user })
  const [naming, setNaming] = useState(false)

  const fullName = profile.data?.display_name ?? ''
  const nickname = nicknameOf(profile.data)
  const shown = nickname ?? fullName
  const initial = (shown.split(' ').at(-1) ?? 'T')[0]?.toUpperCase() ?? 'T'

  return (
    <div className="flex flex-col gap-4">
      <h1 className="pt-2 text-3xl font-extrabold tracking-tight">Profile</h1>

      <section className="card flex flex-col items-center px-5 pt-8 pb-6 text-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative">
          <span className="grid size-36 place-items-center rounded-[2.5rem] border-b-[6px] border-brand-600 bg-brand-400 text-6xl font-extrabold text-white">
            {initial}
          </span>
        </motion.div>

        <button type="button" onClick={() => setNaming(true)} className="mt-4 flex max-w-full items-center gap-2 rounded-xl px-2 py-1 active:bg-ink-100">
          <span className="truncate text-2xl font-extrabold tracking-tight">{shown || 'Chưa đặt tên'}</span>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink-100 text-ink-600">
            <Pencil size={15} strokeWidth={2.6} />
          </span>
        </button>
        {nickname && fullName && <p className="text-sm font-semibold text-ink-500">{fullName}</p>}
        {user.data?.email && <p className="text-sm text-ink-400">{user.data.email}</p>}
      </section>

      <button type="button" onClick={props.onReplayIntro} className="card flex items-center gap-3 p-4 text-left active:scale-[0.99]">
        <TitanSafe size={44} mood="smirk" float={false} />
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold">Nghe Két giới thiệu lại</span>
          <span className="block text-sm text-ink-500">Quên cách dùng thì Két nhắc, có cà khịa nhẹ</span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-ink-300" />
      </button>

      <Button variant="danger" full icon={<LogOut size={18} />} onClick={() => supabase.auth.signOut()}>
        Đăng xuất
      </Button>

      <NicknameSheet open={naming} current={nickname} onClose={() => setNaming(false)} />
    </div>
  )
}
