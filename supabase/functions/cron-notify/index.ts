// POST /functions/v1/cron-notify — pg_cron gọi mỗi giờ (V12-5).
// Xác thực bằng header x-cron-secret (= secret CRON_SECRET), không dùng JWT.
// Body tùy chọn {"at": "<ISO>"} để giả lập thời điểm khi test; {"user_id": "..."} để chỉ chạy cho một người.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { type DayKind, dayKindsConfig, monthStart, spentByParent, weightsOf } from '../_shared/budget.ts'
import { FLOW_SELECT, monthPlan, toFlow, toSources } from '../_shared/cashflow.ts'
import { dueReminder, MORNING_HOUR, monthStartMessage, notifySettings, type PushText, vnClock } from '../_shared/notify.ts'
import { vnDate } from '../_shared/quick-entry.ts'
import { timingSafeEqual } from '../_lib/crypto.ts'
import { json } from '../_lib/http.ts'
import { sendPushToUser } from '../_lib/push.ts'
import { serviceClient } from '../_lib/supabase.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const expected = Deno.env.get('CRON_SECRET')
  const got = req.headers.get('x-cron-secret') ?? ''
  if (!expected || !timingSafeEqual(got, expected)) return json({ error: 'unauthorized' }, 401)

  const body = (await req.json().catch(() => ({}))) as { at?: string; user_id?: string }
  const now = body.at ? new Date(body.at) : new Date()
  if (Number.isNaN(now.getTime())) return json({ error: 'invalid_at' }, 400)
  const { date: today, hour } = vnClock(now)

  const db = serviceClient()
  // V14-17: nhắc nhở lưu vào trang Thông báo cho mọi người đã thiết lập, có bật thông báo đẩy hay không
  let q = db.from('profiles').select('id').not('onboarded_at', 'is', null)
  if (body.user_id) q = q.eq('id', body.user_id)
  const { data: profiles, error } = await q
  if (error) return json({ error: error.message }, 500)
  const users = (profiles ?? []).map((p) => p.id as string)

  // V14-12: chốt hạn mức hôm nay cho mọi người có kế hoạch tháng này (kể cả không bật thông báo).
  // Chạy mỗi giờ nên lần cuối trong ngày giữ đúng hạn mức của ngày; qua ngày mới số đó thành số chốt.
  let frozen = 0
  {
    let pq = db.from('month_plans').select('user_id').eq('month', monthStart(today))
    if (body.user_id) pq = pq.eq('user_id', body.user_id)
    const { data: planned } = await pq
    for (const { user_id } of planned ?? []) {
      try {
        const ctx = await loadPlanContext(db, user_id, today)
        if (!ctx.result) continue
        await db.from('day_limits').upsert({ user_id, day: today, planned: Math.max(0, ctx.result.todayLimit), updated_at: new Date().toISOString() })
        frozen++
      } catch (err) {
        console.error(`day_limits user=${String(user_id).slice(0, 8)}`, (err as Error).message)
      }
    }
  }

  const report: { user: string; sent: string[] }[] = []
  for (const userId of users) {
    try {
      const sent = await notifyUser(db, userId, today, hour)
      if (sent.length) report.push({ user: userId.slice(0, 8), sent })
    } catch (err) {
      console.error(`cron-notify user=${userId.slice(0, 8)}`, (err as Error).message)
    }
  }
  console.log(`cron-notify ${today} ${hour}h users=${users.length} sent=${report.length} frozen=${frozen}`)
  return json({ today, hour, users: users.length, report, frozen })
})

async function notifyUser(db: SupabaseClient, userId: string, today: string, hour: number): Promise<string[]> {
  const { data: profile } = await db.from('profiles').select('settings').eq('id', userId).maybeSingle()
  const settings = notifySettings(profile?.settings as Record<string, unknown> | null)
  // V14-14: bỏ thông báo tổng kết buổi tối; tổng kết từng ngày xem trong lịch hạn mức
  const wantMorning = hour === MORNING_HOUR
  if (!wantMorning) return []

  const ctx = await loadPlanContext(db, userId, today)
  const messages: [string, PushText | null][] = []
  {
    messages.push(['month', monthStartMessage(today)])
    if (ctx.result) messages.push(['due', dueReminder({ today, items: ctx.result.fixedItems, remindDays: settings.remindDays })])
  }
  const sent: string[] = []
  for (const [kind, m] of messages) {
    if (!m) continue
    await sendPushToUser(db, userId, m, 'reminder')
    sent.push(kind)
  }
  return sent
}

/** Dữ liệu giống hệt tab Kế hoạch trên app (V12-9: cùng computePlan) */
async function loadPlanContext(db: SupabaseClient, userId: string, today: string) {
  const month = monthStart(today)
  const start = new Date(`${month}T00:00:00+07:00`)
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)

  const [plan, recurring, days, flowRows, pending, budgets, limits, balances] = await Promise.all([
    db
      .from('month_plans')
      .select('income, savings, created_at, day_kinds, income_sources, carry_over, closed_fixed, extra_to_flex, extra_kept, buffer')
      .eq('user_id', userId)
      .eq('month', month)
      .maybeSingle(),
    db.from('recurring_items').select('id, name, amount, due_day, category_id').eq('user_id', userId).eq('active', true),
    db.from('day_plans').select('day, kind').eq('user_id', userId).gte('day', month).lt('day', vnDate(end)),
    db
      .from('transactions')
      .select(FLOW_SELECT)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('occurred_at', start.toISOString())
      .lt('occurred_at', end.toISOString()),
    db
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null)
      .eq('status', 'pending'),
    db.from('category_budgets').select('amount, category:categories(id, name)').eq('user_id', userId),
    db.from('day_limits').select('day, planned').eq('user_id', userId).gte('day', month).lt('day', vnDate(end)),
    db.from('wallet_balances').select('kind, balance').eq('user_id', userId).in('kind', ['bank', 'cash']),
  ])

  // V16: cùng monthPlan với app (dư tháng trước, nguồn thu, hạn mức theo dòng tiền)
  const flows = ((flowRows.data ?? []) as unknown as Parameters<typeof toFlow>[0][]).map((r) => toFlow(r, vnDate))
  const result = plan.data
    ? monthPlan({
        today,
        month,
        plan: {
          income: Number(plan.data.income),
          savings: Number(plan.data.savings),
          carryOver: !!plan.data.carry_over,
          sources: toSources(plan.data.income_sources),
          createdDay: vnDate(new Date(plan.data.created_at)),
          weights: weightsOf(dayKindsConfig(plan.data.day_kinds)),
          closedFixed: (plan.data.closed_fixed ?? []) as string[],
          extraToFlex: Number(plan.data.extra_to_flex ?? 0),
          extraKept: Number(plan.data.extra_kept ?? 0),
        },
        fixed: (recurring.data ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          amount: Number(r.amount),
          dueDay: r.due_day,
          categoryId: r.category_id,
        })),
        dayKinds: Object.fromEntries((days.data ?? []).map((d) => [d.day, d.kind as DayKind])),
        flows,
        balance: (balances.data ?? []).reduce((s, b) => s + Number(b.balance), 0),
        buffer: Number(plan.data.buffer ?? 0),
        frozen: Object.fromEntries((limits.data ?? []).map((l) => [l.day as string, Number(l.planned)])),
      }).result
    : null

  const spends = flows
    .filter((f) => (f.type === 'expense' || f.type === 'borrow') && f.source !== 'reconcile')
    .map((f) => ({ date: f.date, amount: f.amount, categoryId: f.categoryId, parentId: f.parentId }))

  const byParent = spentByParent(spends, (recurring.data ?? []).map((r) => r.category_id as string | null))
  const overBudget = ((budgets.data ?? []) as unknown as { amount: number; category: { id: string; name: string } | null }[])
    .filter((b) => b.category && (byParent.get(b.category.id) ?? 0) > Number(b.amount))
    .map((b) => b.category!.name)

  return {
    result,
    todaySpent: spends.filter((s) => s.date === today).reduce((t, s) => t + s.amount, 0),
    pending: pending.count ?? 0,
    overBudget,
  }
}
