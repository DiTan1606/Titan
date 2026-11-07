#!/usr/bin/env bash
# Chạy các file test SQL trong supabase/tests/ trên Supabase local.
# Mỗi file tự rollback nên không để lại dữ liệu rác.
set -euo pipefail
cd "$(dirname "$0")/.."
container="supabase_db_titan"
for f in supabase/tests/*.sql; do
  echo "▶ $f"
  docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -t < "$f"
done
echo "✅ Tất cả test database đều qua"
