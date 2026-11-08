-- Test v1.4: chốt hạn mức từng ngày — hôm nay ghi / sửa được, ngày đã qua bị khóa, người khác không thấy.
begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000af', 'af@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000bf', 'bf@test.local', '{}', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000af","role":"authenticated"}', true);

do $$
declare today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date; ok boolean; n int;
begin
  insert into public.day_limits (day, planned) values (today, 100000);
  insert into public.day_limits (day, planned) values (today, 120000)
    on conflict (user_id, day) do update set planned = excluded.planned, updated_at = now();
  assert (select planned from public.day_limits where day = today) = 120000, 'Hôm nay phải sửa được';

  ok := false;
  begin
    insert into public.day_limits (day, planned) values (today - 1, 90000);
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'Ngày đã qua phải bị khóa (không thêm được)';

  ok := false;
  begin
    insert into public.day_limits (day, planned) values (today, -1);
  exception when check_violation then ok := true;
  end;
  assert ok, 'Hạn mức không được âm';
end $$;

-- Ngày đã qua do server chốt (service role) thì người dùng không sửa được
reset role;
insert into public.day_limits (user_id, day, planned) values ('00000000-0000-0000-0000-0000000000af', (now() at time zone 'Asia/Ho_Chi_Minh')::date - 2, 80000);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000af","role":"authenticated"}', true);
do $$
declare n int;
begin
  update public.day_limits set planned = 1 where day < (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  get diagnostics n = row_count;
  assert n = 0, 'Không được sửa hạn mức ngày đã qua';
  assert (select count(*) from public.day_limits) = 2, 'Phải thấy 2 hạn mức của mình';
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000bf","role":"authenticated"}', true);
do $$
begin
  assert (select count(*) from public.day_limits) = 0, 'B thấy hạn mức của A';
end $$;

select 'OK: 015_v14_day_limits' as result;
rollback;
