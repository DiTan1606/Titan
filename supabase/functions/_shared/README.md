# _shared

Code dùng chung giữa **Edge Functions** (Deno) và **web app** (import qua alias `@shared`).

Quy tắc: chỉ để **hàm thuần** ở đây (không gọi mạng, không đụng DB, không dùng API riêng của Deno hay trình duyệt),
import nội bộ luôn ghi rõ đuôi `.ts`, mỗi module có file `*.test.ts` đi kèm.
