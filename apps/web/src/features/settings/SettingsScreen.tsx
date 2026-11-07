import { LogOut } from 'lucide-react'
import { useProfile } from '../../lib/data'
import { supabase } from '../../lib/supabase'
import { Button } from '../../ui/Button'
import { PushTestCard } from '../push/PushTestCard'
import { AutoSyncCard } from './AutoSyncCard'
import { CategoriesCard } from './CategoriesCard'
import { TrashCard } from './TrashCard'

// Tab "Tôi": hồ sơ + thông báo + kết nối Gmail + thùng rác
export function SettingsScreen() {
  const profile = useProfile()
  const name = profile.data?.display_name ?? ''
  const initial = name.split(' ').at(-1)?.[0] ?? 'T'

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-4 pt-2">
        <span className="grid size-16 place-items-center rounded-[1.4rem] border-b-4 border-brand-600 bg-brand-400 text-2xl font-extrabold text-white">
          {initial}
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{name}</h1>
          <p className="text-sm font-semibold text-ink-500">Titan 1.1</p>
        </div>
      </header>

      <PushTestCard />
      <AutoSyncCard />
      <CategoriesCard />
      <TrashCard />

      <Button variant="danger" full icon={<LogOut size={18} />} onClick={() => supabase.auth.signOut()}>
        Đăng xuất
      </Button>
    </div>
  )
}
