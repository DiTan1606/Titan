-- Titan v1.0 · Migration 4: ghi nhớ quán, duyệt giao dịch, thùng rác
-- Tham chiếu: BRD BR-14, BR-15, BR-19 · docs/02 mục 3.3, 4.2, 4.4

-- ─────────────────────────────────────────────────────────────
-- merchant_memory: người dùng xác nhận "quán X là danh mục Y" bao nhiêu lần
-- ─────────────────────────────────────────────────────────────
create table public.merchant_memory (
  user_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  keyword       text not null,   -- đã chuẩn hóa: bỏ dấu, viết thường, bỏ số (merchantKeyword)
  category_id   uuid not null,
  hits          int not null default 1 check (hits > 0),
  last_used_at  timestamptz not null default now(),
  primary key (user_id, keyword, category_id),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete cascade
);

alter table public.merchant_memory enable row level security;
create policy "merchant_memory: toàn quyền với dữ liệu của mình" on public.merchant_memory
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- confirm_transaction: duyệt (kèm sửa) + cập nhật ghi nhớ quán, trong CÙNG một transaction
-- p_patch chỉ nhận các khóa: type, amount, occurred_at, wallet_id, to_wallet_id, category_id,
-- description, merchant, note, tags, mood, counterparty
-- ─────────────────────────────────────────────────────────────
create function public.confirm_transaction(p_id uuid, p_patch jsonb default '{}'::jsonb)
returns public.transactions
language plpgsql
security invoker   -- chạy dưới quyền người dùng: RLS vẫn áp dụng
set search_path = ''
as $$
declare
  t public.transactions;
  allowed text[] := array['type','amount','occurred_at','wallet_id','to_wallet_id','category_id',
                          'description','merchant','note','tags','mood','counterparty'];
  unknown text;
begin
  select k into unknown from jsonb_object_keys(p_patch) k where k <> all (allowed) limit 1;
  if unknown is not null then
    raise exception 'Không được sửa trường "%"', unknown;
  end if;

  update public.transactions set
    type         = case when p_patch ? 'type' then (p_patch->>'type')::public.txn_type else type end,
    amount       = case when p_patch ? 'amount' then (p_patch->>'amount')::bigint else amount end,
    occurred_at  = case when p_patch ? 'occurred_at' then (p_patch->>'occurred_at')::timestamptz else occurred_at end,
    wallet_id    = case when p_patch ? 'wallet_id' then (p_patch->>'wallet_id')::uuid else wallet_id end,
    to_wallet_id = case when p_patch ? 'to_wallet_id' then (p_patch->>'to_wallet_id')::uuid else to_wallet_id end,
    category_id  = case when p_patch ? 'category_id' then (p_patch->>'category_id')::uuid else category_id end,
    description  = case when p_patch ? 'description' then p_patch->>'description' else description end,
    merchant     = case when p_patch ? 'merchant' then p_patch->>'merchant' else merchant end,
    note         = case when p_patch ? 'note' then p_patch->>'note' else note end,
    tags         = case when p_patch ? 'tags'
                     then array(select jsonb_array_elements_text(p_patch->'tags')) else tags end,
    mood         = case when p_patch ? 'mood' then (p_patch->>'mood')::public.txn_mood else mood end,
    counterparty = case when p_patch ? 'counterparty' then p_patch->>'counterparty' else counterparty end,
    status       = 'confirmed'
  where id = p_id and deleted_at is null
  returning * into t;

  if t.id is null then
    raise exception 'Không tìm thấy giao dịch';
  end if;

  -- BR-14: học từ lựa chọn của người dùng
  if t.merchant is not null and t.merchant <> '' and t.category_id is not null then
    insert into public.merchant_memory (user_id, keyword, category_id)
    values (t.user_id, t.merchant, t.category_id)
    on conflict (user_id, keyword, category_id)
      do update set hits = public.merchant_memory.hits + 1, last_used_at = now();
  end if;

  return t;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Thùng rác (BR-19)
-- ─────────────────────────────────────────────────────────────
create function public.soft_delete_transaction(p_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.transactions set deleted_at = now() where id = p_id and deleted_at is null;
$$;

create function public.restore_transaction(p_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.transactions set deleted_at = null where id = p_id;
$$;

revoke execute on function public.confirm_transaction(uuid, jsonb) from public, anon;
revoke execute on function public.soft_delete_transaction(uuid) from public, anon;
revoke execute on function public.restore_transaction(uuid) from public, anon;
grant execute on function public.confirm_transaction(uuid, jsonb) to authenticated;
grant execute on function public.soft_delete_transaction(uuid) to authenticated;
grant execute on function public.restore_transaction(uuid) to authenticated;

-- Xóa vĩnh viễn giao dịch trong thùng rác quá 30 ngày — 03:00 giờ Việt Nam (20:00 UTC)
create extension if not exists pg_cron;

create function public.purge_trash()
returns int
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.transactions where deleted_at < now() - interval '30 days' returning 1
  )
  select count(*)::int from gone;
$$;

revoke execute on function public.purge_trash() from public, anon, authenticated;

select cron.schedule('titan-purge-trash', '0 20 * * *', $$select public.purge_trash()$$);
