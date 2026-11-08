#!/usr/bin/env bash
# Test tích hợp ingest-sms trên Supabase LOCAL.
# Cần: `pnpm db:start` + `supabase functions serve` đang chạy, và tài khoản dev@titan.test.
# Dữ liệu thử của dev@titan.test được dọn sạch sau khi chạy.
set -euo pipefail
cd "$(dirname "$0")/.."

DB="docker exec -i supabase_db_titan psql -U postgres -d postgres -v ON_ERROR_STOP=1 -qtA"
URL="http://127.0.0.1:54321/functions/v1/ingest-sms"
DEV_EMAIL="dev@titan.test"
pass=0; fail=0

uid=$($DB -c "select id from auth.users where email = '$DEV_EMAIL'")
[ -n "$uid" ] || { echo "Thiếu tài khoản $DEV_EMAIL"; exit 1; }

cleanup() {
  $DB -c "delete from public.transactions where user_id = '$uid';
          delete from public.sms_messages where user_id = '$uid';
          delete from public.merchant_memory where user_id = '$uid';
          delete from public.notifications where user_id = '$uid';
          delete from public.api_tokens where user_id = '$uid';
          update public.profiles set onboarded_at = null where id = '$uid';
          delete from public.wallets where user_id = '$uid' and kind = 'fund' and name = 'Quỹ test';
          update public.wallets set opening_balance = 0, account_suffix = null where user_id = '$uid';" >/dev/null
}
cleanup
trap cleanup EXIT

# Tạo token như người dùng thật (gọi RPC dưới quyền dev)
TOKEN=$($DB -c "set role authenticated;
  select set_config('request.jwt.claims', '{\"sub\":\"$uid\",\"role\":\"authenticated\"}', true);
  select public.rotate_api_token();" | tail -1)

# Số dư ban đầu khớp với mẫu SMS để kiểm tra BR-08
$DB -c "update public.wallets set opening_balance = 1269567 where user_id = '$uid' and kind = 'bank';
        update public.profiles set onboarded_at = now() where id = '$uid';" >/dev/null

send() { # $1 token, $2 text → in ra "HTTP_CODE BODY"
  local body
  body=$(python3 -c 'import json,sys; print(json.dumps({"text": sys.argv[1], "sender": "Vietcombank"}))' "$2")
  curl -s -w '\n%{http_code}' -X POST "$URL" -H "x-titan-token: $1" -H 'Content-Type: application/json' -d "$body"
}

check() { # $1 mô tả, $2 kết quả thực, $3 chuỗi mong đợi
  if [[ "$2" == *"$3"* ]]; then echo "  ✅ $1"; pass=$((pass+1)); else echo "  ❌ $1 — nhận: $2"; fail=$((fail+1)); fi
}

SPEND='SD TK 0071000123456 -35,000VND luc 06-11-2026 12:30:15. SD 1,234,567VND. Ref MBVCB.11223344.COM TAM SUON'
ATM='SD TK 0071000123456 -500,000VND luc 06-11-2026 18:20:00. SD 734,567VND. Ref RUT TIEN MAT TAI ATM VCB'
OTP='Ma OTP cua Quy khach la 123456.'
LEAK='SD TK 0071000123456 -10,000VND luc 06-11-2026 19:00:00. SD 1,000VND. Ref BANH MI'

echo "▶ ingest-sms"
check "token sai → 401"              "$(send 'titan_sai' "$SPEND" | tail -1)" "401"
check "thiếu token → 401"            "$(send '' "$SPEND" | tail -1)" "401"
r=$(send "$TOKEN" "$SPEND" | head -1)
check "chi tiêu → created"           "$r" '"status":"created"'
check "số dư khớp → không cảnh báo"  "$r" '"balance_warning":null'
check "gửi lại SMS → duplicate"      "$(send "$TOKEN" "$SPEND" | head -1)" '"status":"duplicate"'
check "rút ATM → transfer"           "$(send "$TOKEN" "$ATM" | head -1)" '"type":"transfer"'
check "OTP → ignored"                "$(send "$TOKEN" "$OTP" | head -1)" '"status":"ignored"'
check "số dư lệch → cảnh báo"        "$(send "$TOKEN" "$LEAK" | head -1)" 'lệch'

echo "▶ ghi nhớ quán (Ngày 3)"
as_user() { $DB -c "set role authenticated; select set_config('request.jwt.claims', '{\"sub\":\"$uid\",\"role\":\"authenticated\"}', true); $1" | tail -1; }
MEAL=$($DB -c "select id from public.categories where user_id='$uid' and name='Ăn chính'")
SPEND_ID=$($DB -c "select id from public.transactions where user_id='$uid' and merchant='com tam suon'")
as_user "select (public.confirm_transaction('$SPEND_ID', '{\"category_id\":\"$MEAL\"}')).status" >/dev/null
check "duyệt xong → có ghi nhớ"      "$($DB -c "select hits from public.merchant_memory where user_id='$uid' and keyword='com tam suon'")" "1"
SPEND2='SD TK 0071000123456 -40,000VND luc 08-11-2026 12:10:00. SD 684,567VND. Ref MBVCB.55667788.COM TAM SUON'
r=$(send "$TOKEN" "$SPEND2" | head -1)
check "quán quen → gợi ý đúng danh mục" "$($DB -c "select category_id from public.transactions where user_id='$uid' and amount=40000")" "$MEAL"
check "thông báo ghi tên danh mục"   "$r" 'Ăn chính?'
check "rút ATM không có danh mục"    "$($DB -c "select coalesce(category_id::text,'null') from public.transactions where user_id='$uid' and type='transfer'")" "null"

echo "▶ suggest-category"
PW=$(grep '^DEV_USER_PASSWORD=' supabase/.env | cut -d= -f2)
ANON=$(supabase status -o env 2>/dev/null | grep '^ANON_KEY=' | cut -d= -f2 | tr -d '"')
JWT=$(curl -s "http://127.0.0.1:54321/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$DEV_EMAIL\",\"password\":\"$PW\"}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')
SURL="http://127.0.0.1:54321/functions/v1/suggest-category"
r=$(curl -s -X POST "$SURL" -H "Authorization: Bearer $JWT" -H 'Content-Type: application/json' \
  -d '{"items":[{"description":"Cơm tấm sườn","amount":35000},{"description":"xyz chưa từng thấy","amount":10000}]}')
check "món quen → lấy từ ghi nhớ"    "$r" "\"category_id\":\"$MEAL\""
check "giữ đúng thứ tự, đủ 2 món"    "$(echo "$r" | python3 -c 'import json,sys; d=json.load(sys.stdin)["items"]; print(len(d), d[0]["source"])')" "2 memory"
check "không có JWT → 401"           "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$SURL" -d '{}')" "401"
check "dữ liệu sai → 400"            "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$SURL" -H "Authorization: Bearer $JWT" -d '{"items":[{"description":"","amount":-1}]}')" "400"

echo "▶ dữ liệu trong DB"
check "3 giao dịch chờ duyệt"        "$($DB -c "select count(*) from public.transactions where user_id='$uid' and status='pending'")" "3"
check "5 SMS được lưu (không trùng)"  "$($DB -c "select count(*) from public.sms_messages where user_id='$uid'")" "5"
check "không lưu số TK gốc"          "$($DB -c "select count(*) from public.sms_messages where user_id='$uid' and body_masked like '%0071000123456%'")" "0"
check "tiền mặt +500k sau rút ATM"   "$($DB -c "select balance from public.wallet_balances where user_id='$uid' and kind='cash'")" "500000"
check "số dư VCB đúng"               "$($DB -c "select balance from public.wallet_balances where user_id='$uid' and kind='bank'")" "684567"

echo "▶ email biên lai VCB (số tài khoản giả)"
receipt() { # $1 order, $2 debit, $3 credit, $4 beneficiary, $5 amount, $6 content
  printf 'Biên lai chuyển tiền qua tài khoản\n(Payment Receipt)\nNgày, giờ giao dịch\nTrans. Date, Time\n12:10 Thứ Bảy 07/11/2026\nSố lệnh giao dịch\nOrder Number\n%s\nTài khoản nguồn\nDebit Account\n%s\nTên người chuyển tiền\nRemitter’s name\nNGUYEN VAN B\nTài khoản người hưởng\nCredit Account\n%s\nTên người hưởng\nBeneficiary Name\n%s\nTên ngân hàng hưởng\nBeneficiary Bank Name\nVietcombank\nSố tiền\nAmount\n%s VND\nLoại phí\nCharge Code\nNgười chuyển trả\nSố tiền phí\nCharge Amount\n0 VND\nNội dung chuyển tiền\nDetails of Payment\n%s\nCám ơn Quý khách!' "$@"
}
R_OUT=$(receipt 10000000901 1012344321 9876501234 'TRA SUA PHUC LONG' '45,000' 'NGUYEN VAN A chuyen tien')
R_IN=$(receipt 10000000902 9876501234 1012344321 'NGUYEN VAN A' '7,000,000' 'Bo me gui tien thang 11')
check "chưa cài 4 số cuối → failed"   "$(send "$TOKEN" "$R_OUT" | head -1)" 'account_suffix_missing'
$DB -c "delete from public.sms_messages where user_id='$uid' and parser_version like 'vcb-receipt%'; update public.wallets set account_suffix='4321' where user_id='$uid' and kind='bank';" >/dev/null
check "biên lai tiền ra → created"    "$(send "$TOKEN" "$R_OUT" | head -1)" '"type":"expense"'
check "từ điển: Phúc Long → Trà sữa"   "$($DB -c "select c.name from public.transactions t join public.categories c on c.id=t.category_id where t.user_id='$uid' and t.amount=45000")" "Trà sữa/Cà phê"
check "lưu tên người nhận"            "$($DB -c "select counterparty from public.transactions where user_id='$uid' and amount=45000")" "TRA SUA PHUC LONG"
check "cùng số lệnh → duplicate"      "$(send "$TOKEN" "$R_OUT"$'\n(gửi lại)' | head -1)" '"status":"duplicate"'
check "biên lai tiền vào → income"    "$(send "$TOKEN" "$R_IN" | head -1)" '"type":"income"'
check "từ điển: bố mẹ gửi → Gia đình" "$($DB -c "select c.name from public.transactions t join public.categories c on c.id=t.category_id where t.user_id='$uid' and t.amount=7000000")" "Gia đình gửi"
R_SELF=$(receipt 10000000903 1012344321 9876501234 'NGUYEN VAN B' '81,000' 'NGUYEN VAN B chuyen tien')
check "tự chuyển giữa tài khoản → transfer" "$(send "$TOKEN" "$R_SELF" | head -1)" '"type":"transfer"'
check "tự chuyển: ví đích là Tài khoản khác" "$($DB -c "select w.kind from public.transactions t join public.wallets w on w.id=t.to_wallet_id where t.user_id='$uid' and t.amount=81000")" "external"
check "không lưu số TK gốc trong email" "$($DB -c "select count(*) from public.sms_messages where user_id='$uid' and body_masked like '%1012344321%'")" "0"

echo "▶ trùng 4 số cuối (V13-13)"
R_TWIN=$(receipt 10000000904 1012344321 5550004321 'TRAN THI C' '60,000' 'tra tien an trua')
check "chỉ 4 số cuối, người nhận trùng đuôi → báo nhập đủ số" "$(send "$TOKEN" "$R_TWIN" | head -1)" 'account_ambiguous'
as_user "select public.set_bank_account('1012344321')" >/dev/null
$DB -c "delete from public.sms_messages where user_id='$uid' and dedupe_key = encode(sha256(convert_to('vcb-order:10000000904','UTF8')),'hex');" >/dev/null
check "đủ số tài khoản → phân biệt đúng tiền ra" "$(send "$TOKEN" "$R_TWIN" | head -1)" '"type":"expense"'
check "người nhận đúng là người trùng đuôi" "$($DB -c "select counterparty from public.transactions where user_id='$uid' and amount=60000")" "TRAN THI C"

echo "▶ quỹ gắn tài khoản thật (V14-10)"
FUND=$(as_user "select public.create_fund('Quỹ test', '19033344455', 'MB')")
R_DEP=$(receipt 10000000905 1012344321 19033344455 'NGUYEN VAN B' '500,000' 'de danh')
check "chuyển tới tài khoản quỹ → transfer" "$(send "$TOKEN" "$R_DEP" | head -1)" '"type":"transfer"'
check "bỏ vào quỹ: tự duyệt, ví đích là quỹ" "$($DB -c "select status || ' ' || (to_wallet_id = '$FUND') from public.transactions where user_id='$uid' and amount=500000")" "confirmed true"
R_WD=$(receipt 10000000906 19033344455 1012344321 'NGUYEN VAN B' '200,000' 'rut quy')
check "tiền từ tài khoản quỹ về VCB → transfer" "$(send "$TOKEN" "$R_WD" | head -1)" '"type":"transfer"'
check "số dư quỹ sau bỏ vào / rút ra" "$($DB -c "select balance from public.wallet_balances where wallet_id='$FUND'")" "300000"
check "không tính là chi tiêu / thu nhập" "$($DB -c "select count(*) from public.transactions where user_id='$uid' and amount in (500000, 200000) and type <> 'transfer'")" "0"

echo
echo "Kết quả: $pass qua, $fail lỗi"
[ "$fail" -eq 0 ]
