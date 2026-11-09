-- Titan v1.6.3 · Tên khoản cố định / nguồn thu chính là danh mục chi tiết của nó (V16-15).
-- Tiến độ chỉ đếm giao dịch đúng danh mục chi tiết đó, nên chuyển dữ liệu cũ:
--   khoản gắn danh mục lớn → gắn danh mục chi tiết trùng tên (chưa có thì tạo);
--   khoản gắn danh mục chi tiết khác tên → đổi tên danh mục đó theo tên khoản (nếu không dùng chung), hoặc dùng / tạo cái trùng tên.

create function public.named_subcategory(p_user uuid, p_category uuid, p_name text, p_owner_count int)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  c public.categories;
  parent uuid;
  clean text := left(trim(p_name), 40);
  hit uuid;
begin
  select * into c from public.categories where id = p_category and user_id = p_user;
  if c.id is null or clean = '' or c.system_key is not null then
    return p_category;
  end if;
  parent := coalesce(c.parent_id, c.id);

  -- đã có danh mục chi tiết trùng tên
  select id into hit from public.categories
   where user_id = p_user and parent_id = parent and lower(name) = lower(clean)
   order by hidden_at nulls first limit 1;
  if hit is not null then
    update public.categories set hidden_at = null where id = hit and hidden_at is not null;
    return hit;
  end if;

  -- đang gắn danh mục chi tiết của riêng mình → đổi tên theo tên khoản
  if c.parent_id is not null and p_owner_count <= 1 then
    update public.categories set name = clean where id = c.id;
    return c.id;
  end if;

  insert into public.categories (user_id, kind, name, parent_id, sort_order)
  values (p_user, c.kind, clean, parent, 900)
  returning id into hit;
  return hit;
end;
$$;
revoke execute on function public.named_subcategory(uuid, uuid, text, int) from public, anon, authenticated;

do $$
declare
  r record;
  p record;
  src jsonb;
  out jsonb;
  cat uuid;
  i int;
begin
  -- khoản cố định
  for r in
    select ri.*, (select count(*) from public.recurring_items o where o.category_id = ri.category_id) as owners
      from public.recurring_items ri where ri.category_id is not null
  loop
    cat := public.named_subcategory(r.user_id, r.category_id, r.name, r.owners::int);
    if cat is distinct from r.category_id then
      update public.recurring_items set category_id = cat where id = r.id;
    end if;
  end loop;

  -- nguồn thu trong kế hoạch tháng
  for p in select user_id, month, income_sources from public.month_plans where jsonb_array_length(income_sources) > 0 loop
    out := '[]'::jsonb;
    for i in 0 .. jsonb_array_length(p.income_sources) - 1 loop
      src := p.income_sources -> i;
      if src ? 'category_id' and jsonb_typeof(src -> 'category_id') = 'string' then
        cat := public.named_subcategory(p.user_id, (src ->> 'category_id')::uuid, src ->> 'name', 1);
        src := jsonb_set(src, '{category_id}', to_jsonb(cat::text));
      end if;
      out := out || jsonb_build_array(src);
    end loop;
    update public.month_plans set income_sources = out where user_id = p.user_id and month = p.month;
  end loop;
end $$;

drop function public.named_subcategory(uuid, uuid, text, int);
