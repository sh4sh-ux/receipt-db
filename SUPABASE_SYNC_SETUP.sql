-- 영수증DB v2.04 동기화 테이블
-- Supabase SQL Editor에 그대로 붙여넣고 Run 하면 됩니다.
-- 개인용 앱에서 가장 단순하게 모바일/데스크탑 동기화를 시작하는 구조입니다.

create table if not exists public.receipt_records (
  id text primary key,
  space_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create index if not exists receipt_records_space_id_idx
  on public.receipt_records(space_id);

create index if not exists receipt_records_updated_at_idx
  on public.receipt_records(updated_at desc);

-- 주의:
-- 현재 앱은 로그인 없이 쓰는 개인용 정적 앱이라 anon key로 읽기/쓰기를 합니다.
-- Supabase Table Editor에서 RLS를 켜면 앱 연결이 막힐 수 있습니다.
-- 더 안전한 가족/팀 공유 버전은 Supabase Auth 또는 서버 API를 붙이는 다음 단계에서 만드는 것이 좋습니다.
