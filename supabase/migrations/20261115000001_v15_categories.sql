-- Titan v1.5 · Danh mục sửa được như Các loại ngày (docs/11-v1.5-tour-danh-muc.md)
-- Màu riêng, icon theo bộ icon của app, xóa danh mục chưa dùng, ẩn / hiện lại danh mục đã dùng.

-- 1. Màu danh mục (null = màu mặc định theo nhóm). Icon dùng lại cột icon: tên icon trong bộ của app
alter table public.categories add column color text
  check (color is null or color ~ '^#[0-9A-Fa-f]{6}$');
alter table public.categories add constraint categories_name_len check (length(trim(name)) between 1 and 40);

-- 2. "Chi tiêu không rõ" (danh mục hệ thống) không được ẩn, đổi tên hay đổi chỗ
create function public.protect_system_category()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.system_key is not null and (
       new.hidden_at is not null or new.name <> old.name or new.parent_id is distinct from old.parent_id or new.kind <> old.kind) then
    raise exception 'system_category_locked';
  end if;
  return new;
end;
$$;

revoke execute on function public.protect_system_category() from public, anon, authenticated;

create trigger categories_protect_system_update
  before update on public.categories
  for each row execute function public.protect_system_category();

-- 3. Mỗi danh mục đang được dùng ở đâu (của chính người gọi, RLS lo phần giới hạn)
create function public.category_usage()
returns table (category_id uuid, txns bigint, budgets bigint, recurring bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id,
         (select count(*) from public.transactions t where t.category_id = c.id),
         (select count(*) from public.category_budgets b where b.category_id = c.id),
         (select count(*) from public.recurring_items r where r.category_id = c.id)
    from public.categories c
   where c.user_id = (select auth.uid());
$$;
revoke execute on function public.category_usage() from public, anon;
grant execute on function public.category_usage() to authenticated;

-- 4. Xóa danh mục: chỉ khi nó và các danh mục chi tiết bên trong chưa dùng ở đâu
--    (ghi nhớ quán trỏ tới danh mục bị xóa sẽ tự xóa theo)
create function public.delete_category(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c public.categories;
  ids uuid[];
begin
  select * into c from public.categories where id = p_id and user_id = (select auth.uid());
  if not found then
    raise exception 'category_not_found';
  end if;
  if c.system_key is not null then
    raise exception 'system_category_locked';
  end if;

  select array_agg(id) into ids from public.categories where id = p_id or parent_id = p_id;

  if exists (select 1 from public.transactions where category_id = any (ids))
     or exists (select 1 from public.category_budgets where category_id = any (ids))
     or exists (select 1 from public.recurring_items where category_id = any (ids)) then
    raise exception 'category_in_use';
  end if;

  delete from public.categories where id = p_id;
end;
$$;
revoke execute on function public.delete_category(uuid) from public, anon;
grant execute on function public.delete_category(uuid) to authenticated;
