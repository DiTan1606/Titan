-- Titan v1.0 · Migration 8: sửa giao dịch ĐÃ DUYỆT thì ghi nhớ quán cũng được sửa theo (BR-14)
-- Trước đây: chỉ cộng ghi nhớ. Nếu người dùng chọn nhầm danh mục rồi sửa lại, hoặc đổi sang chuyển khoản / trả nợ,
-- ghi nhớ sai vẫn còn. Giờ: gỡ lựa chọn cũ (trừ 1 lần, về 0 thì xóa) rồi mới học lựa chọn mới.

create or replace function public.confirm_transaction(p_id uuid, p_patch jsonb default '{}'::jsonb)
returns public.transactions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  old_t public.transactions;
  t public.transactions;
  allowed text[] := array['type','amount','occurred_at','wallet_id','to_wallet_id','category_id',
                          'description','merchant','note','tags','mood','counterparty'];
  unknown text;
begin
  select k into unknown from jsonb_object_keys(p_patch) k where k <> all (allowed) limit 1;
  if unknown is not null then
    raise exception 'Không được sửa trường "%"', unknown;
  end if;

  select * into old_t from public.transactions where id = p_id and deleted_at is null;
  if old_t.id is null then
    raise exception 'Không tìm thấy giao dịch';
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

  -- Không đổi gì về quán / danh mục → giữ nguyên ghi nhớ (tránh cộng thêm mỗi lần sửa ghi chú)
  if old_t.status = 'confirmed'
     and old_t.merchant is not distinct from t.merchant
     and old_t.category_id is not distinct from t.category_id then
    return t;
  end if;

  -- Gỡ lựa chọn cũ (chỉ khi giao dịch đã duyệt trước đó — lúc đó ghi nhớ mới được học)
  if old_t.status = 'confirmed' and old_t.merchant is not null and old_t.category_id is not null then
    -- Xóa trước dòng chỉ còn 1 lần (ràng buộc hits > 0 không cho trừ về 0), rồi mới trừ
    delete from public.merchant_memory
     where user_id = old_t.user_id and keyword = old_t.merchant and category_id = old_t.category_id and hits <= 1;
    update public.merchant_memory set hits = hits - 1
     where user_id = old_t.user_id and keyword = old_t.merchant and category_id = old_t.category_id;
  end if;

  -- Học lựa chọn mới
  if t.merchant is not null and t.merchant <> '' and t.category_id is not null then
    insert into public.merchant_memory (user_id, keyword, category_id)
    values (t.user_id, t.merchant, t.category_id)
    on conflict (user_id, keyword, category_id)
      do update set hits = public.merchant_memory.hits + 1, last_used_at = now();
  end if;

  return t;
end;
$$;
