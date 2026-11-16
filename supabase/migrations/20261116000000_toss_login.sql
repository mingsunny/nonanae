-- 토스 미니앱(앱인토스) 토스 로그인.
-- Edge Function toss-login이 토스 서버에서 받은 사용자 키(userKey)로 Supabase 계정을 찾거나 만든다.
-- 웹(이메일 가입) 사용자에게는 영향이 없다. 적용 순서: 이 SQL → Edge Function 배포 → 토스 빌드 업로드.
-- 20261027000000_delete_audit_log_on_withdraw.sql(delete_auth_audit_logs)이 먼저 적용돼 있어야 한다.

-- ============================================================
-- 1. 토스 userKey ↔ Supabase 계정
-- ============================================================
create table public.toss_accounts (
  -- 토스가 미니앱마다 따로 발급하는 사용자 키. 토스 연결을 끊었다 다시 로그인해도 같은 값이다
  user_key bigint primary key,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.toss_accounts enable row level security;
-- 정책 없음: 앱(anon/authenticated)은 읽지도 쓰지도 못하고, Edge Function(service_role)만 다룬다
revoke all on public.toss_accounts from anon, authenticated;

-- ============================================================
-- 2. 토스에서 연결을 끊으면(연결 끊기·약관 철회·토스 탈퇴) 그 사람 계정을 탈퇴 처리한다
--    앱인토스 체크리스트: "토스 로그인 연결을 끊으면 미니앱에 사용자 데이터가 남지 않아요"
--    delete_my_account()와 같은 처리를 하되, 로그인한 본인 대신 인자로 받은 계정에 한다 (Edge Function toss-unlink 전용)
-- ============================================================
create or replace function public.delete_account_by_id(p_user_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  gid uuid;
  v_email text;
begin
  if p_user_id is null then return; end if;

  for gid in select group_id from public.members where user_id = p_user_id and role = 'owner' loop
    perform public.hand_over_owner(gid, p_user_id);
  end loop;

  select email into v_email from auth.users where id = p_user_id;
  perform public.delete_auth_audit_logs(p_user_id, v_email);

  delete from auth.users where id = p_user_id;
end
$$;
revoke all on function public.delete_account_by_id(uuid) from public, anon, authenticated;
grant execute on function public.delete_account_by_id(uuid) to service_role;
