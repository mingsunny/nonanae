-- 탈퇴할 때 인증 감사 로그(auth.audit_log_entries)에 남은 본인 기록도 지운다
-- (20261025000000_safe_join_policy.sql 다음에 실행. 교체만 하는 단계라 앱 배포와 순서 무관)
--
-- Supabase Auth는 가입·로그인·비밀번호 변경 등을 감사 로그에 남기고, 그 payload에 이메일이 들어간다.
-- 계정(auth.users)을 지워도 이 로그는 남아서, 처리방침의 "탈퇴하면 이메일을 바로 삭제" 문구와 어긋났다.
--   * payload 모양: {"actor_id": "<user id>", "actor_username": "<email>", "traits": {"user_id": ..., "user_email": ...}, ...}
--     본인이 한 일은 actor_*에, 다른 주체(관리자 등)가 그 사람에게 한 일은 traits에 들어가므로 둘 다 지운다.
--   * 지워도 서비스 동작은 바뀌지 않는다 — 앱과 인증 서버 모두 이 로그를 읽지 않는다. 그룹에 남는 이름·지출 기록과도 무관하다.
--   * 감사 로그를 지울 권한이 없는 환경이면 경고만 남기고 탈퇴는 그대로 진행한다(탈퇴가 막히면 안 되므로).
-- 맨 아래에서 이미 탈퇴한 사람의 기록도 한 번 정리한다.

-- ============================================================
-- 1. 특정 사용자의 감사 로그 지우기
-- ============================================================

create or replace function public.delete_auth_audit_logs(p_user_id uuid, p_email text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid text := p_user_id::text;
  mail text := nullif(lower(btrim(coalesce(p_email, ''))), '');
begin
  delete from auth.audit_log_entries a
  where a.payload ->> 'actor_id' = uid
     or a.payload -> 'traits' ->> 'user_id' = uid
     or (mail is not null and (
           lower(a.payload ->> 'actor_username') = mail
        or lower(a.payload -> 'traits' ->> 'user_email') = mail));
exception
  when insufficient_privilege then
    raise warning 'auth.audit_log_entries를 지울 권한이 없어 감사 로그 삭제를 건너뜀';
end
$$;

revoke all on function public.delete_auth_audit_logs(uuid, text) from public, anon, authenticated;

-- ============================================================
-- 2. 회원 탈퇴: 20261025000000과 같고, 계정을 지우기 전에 감사 로그를 지우는 줄만 추가
-- ============================================================

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = ''
as $$
declare
  gid uuid;
  my_email text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if public.is_anonymous_user() then raise exception 'guests cannot delete accounts'; end if;

  for gid in select group_id from public.members where user_id = auth.uid() and role = 'owner' loop
    perform public.hand_over_owner(gid, auth.uid());
  end loop;

  select email into my_email from auth.users where id = auth.uid();
  perform public.delete_auth_audit_logs(auth.uid(), my_email);

  delete from auth.users where id = auth.uid();
end
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ============================================================
-- 3. 이미 탈퇴한 사람의 감사 로그 정리 (지금 있는 계정의 기록은 건드리지 않는다)
-- ============================================================

-- 이메일을 바꾼 계정의 예전 이메일 기록도 함께 지워진다(지워도 해가 없다). 권한이 없으면 경고만 남긴다.
do $$
begin
  delete from auth.audit_log_entries a
  where (
      a.payload ->> 'actor_username' like '%@%'
      and not exists (select 1 from auth.users u where lower(u.email) = lower(a.payload ->> 'actor_username'))
    ) or (
      a.payload -> 'traits' ->> 'user_email' like '%@%'
      and not exists (select 1 from auth.users u where lower(u.email) = lower(a.payload -> 'traits' ->> 'user_email'))
    );
exception
  when insufficient_privilege then
    raise warning 'auth.audit_log_entries를 지울 권한이 없어 정리를 건너뜀';
end
$$;
