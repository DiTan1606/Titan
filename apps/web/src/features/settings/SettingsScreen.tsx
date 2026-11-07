import { LogOut, Pencil } from 'lucide-react'
import { useState } from 'react'
import { nicknameOf, useProfile } from '../../lib/data'
import { supabase } from '../../lib/supabase'
import { Button } from '../../ui/Button'
import { PushTestCard } from '../push/PushTestCard'
import { AutoSyncCard } from './AutoSyncCard'
import { CategoriesCard } from './CategoriesCard'
import { NicknameSheet } from './NicknameSheet'
import { RemindersCard } from './RemindersCard'
import { TrashCard } from './TrashCard'

// Tab "Tôi": hồ sơ + thông báo + kết nối Gmail + thùng rác
export function SettingsScreen() {
  const profile = useProfile()
  const name = profile.data?.display_name ?? ''
  const nickname = nicknameOf(profile.data)
  const initial = (nickname ?? name.split(' ').at(-1))?.[0] ?? 'T'
  const [naming, setNaming] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-4 pt-2">
        <span className="grid size-16 place-items-center rounded-[1.4rem] border-b-4 border-brand-600 bg-brand-400 text-2xl font-extrabold text-white">
          {initial}
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{name}</h1>
          <p className="text-sm font-semibold text-ink-500">Titan 1.3.1</p>
        </div>
      </header>

      {/* V13-2 · Biệt danh hiện ở lời chào Trang chủ */}
      <button type="button" onClick={() => setNaming(true)} className="card flex items-center gap-3 p-4 text-left active:scale-[0.99]">
        <span className="flex-1">
          <span className="block text-sm font-bold text-ink-500">Biệt danh</span>
          <span className="block text-lg font-extrabold">{nickname ?? 'Chưa đặt'}</span>
        </span>
        <Pencil size={18} className="text-ink-400" />
      </button>
      <NicknameSheet open={naming} current={nickname} onClose={() => setNaming(false)} />

      <PushTestCard />
      <RemindersCard />
      <AutoSyncCard />
      <CategoriesCard />
      <TrashCard />

      <Button variant="danger" full icon={<LogOut size={18} />} onClick={() => supabase.auth.signOut()}>
        Đăng xuất
      </Button>
    </div>
  )
}
