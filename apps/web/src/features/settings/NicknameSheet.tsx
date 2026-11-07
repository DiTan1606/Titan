import { useState } from 'react'
import { useSaveSettings } from '../../lib/data'
import { Button } from '../../ui/Button'
import { Sheet } from '../../ui/Sheet'
import { useToast } from '../../ui/toast-context'

/** V13-2 · Biệt danh trên Trang chủ (profiles.settings.nickname) */
export function NicknameSheet(props: { open: boolean; current: string | null; onClose: () => void }) {
  return (
    <Sheet open={props.open} onClose={props.onClose} title="Titan nên gọi bạn là gì?">
      {props.open && <Form current={props.current} onClose={props.onClose} />}
    </Sheet>
  )
}

function Form(props: { current: string | null; onClose: () => void }) {
  const [name, setName] = useState(props.current ?? '')
  const save = useSaveSettings()
  const toast = useToast()

  async function submit() {
    try {
      await save({ nickname: name.trim().slice(0, 24) || null })
      props.onClose()
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    }
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <input
        value={name}
        maxLength={24}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ví dụ: Sếp, Bé Heo, Đại gia"
        className="h-14 rounded-2xl border-2 border-ink-100 px-4 text-lg font-bold outline-none placeholder:text-ink-300 focus:border-brand-300"
      />
      <Button type="submit" variant="primary" full>
        Lưu
      </Button>
    </form>
  )
}
