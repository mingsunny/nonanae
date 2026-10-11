-- 회원가입 순서를 "이메일·비밀번호 → 이메일 확인 → 이름·계좌 입력"으로 바꾸기 위한 준비 (추가만 하는 안전한 단계)
--
-- 지금까지는 가입 요청에 이름·은행·계좌를 함께 실어 보내서 가입 트리거가 profiles 행을 바로 만들었다.
-- 새 순서에서는 가입 요청에 이메일·비밀번호만 있고, 확인 메일 링크를 눌러 로그인된 뒤에 이름·계좌를 받는다.
--   1) 가입 트리거: 요청에 이름·은행·계좌가 다 있을 때만 프로필을 만든다(예전 앱 호환). 없으면 프로필 없이 계정만 만든다.
--   2) complete_profile(): 로그인한 사람이 자기 프로필을 한 번 만든다. 이미 있으면 거절.
-- 프로필이 없는 계정은 그룹을 만들거나 참여할 수 없다 — members.user_id가 profiles를 가리키는 FK라서 DB가 이미 막는다.
-- 예전 앱을 그대로 두고 이 SQL을 먼저 적용해도 안전하다(가입 요청에 이름·계좌가 있으면 이전과 똑같이 동작).

-- ============================================================
-- 1. 가입 트리거: 이름·은행·계좌가 있을 때만 프로필 생성
-- ============================================================

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  n text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'name', '')), '');
  b text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'bank', '')), '');
  a text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'account', '')), '');
begin
  if new.is_anonymous then
    return new;
  end if;

  -- 이름·계좌까지 받은 가입(예전 흐름)만 프로필을 바로 만든다. 새 흐름은 확인 뒤 complete_profile()로 만든다.
  if n is not null and b is not null and a is not null then
    insert into public.profiles (id, name, bank, account)
    values (new.id, n, b, a);

    -- 은행·계좌 사본은 profiles에만 두면 되므로 로그인 정보 쪽은 지운다 (20261003000000과 같은 규칙)
    update auth.users
       set raw_user_meta_data = raw_user_meta_data - 'bank' - 'account'
     where id = new.id;
  end if;

  return new;
end
$$;

-- ============================================================
-- 2. 로그인한 본인의 프로필 만들기
-- ============================================================

create or replace function public.complete_profile(p_name text, p_bank text, p_account text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  n text := btrim(coalesce(p_name, ''));
  b text := btrim(coalesce(p_bank, ''));
  a text := btrim(coalesce(p_account, ''));
begin
  if auth.uid() is null or public.is_anonymous_user() then
    raise exception 'not authenticated';
  end if;
  if n = '' or b = '' or a = '' then
    raise exception 'name, bank and account are required';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'profile already exists';
  end if;

  insert into public.profiles (id, name, bank, account) values (auth.uid(), n, b, a);
end
$$;

revoke all on function public.complete_profile(text, text, text) from public, anon;
grant execute on function public.complete_profile(text, text, text) to authenticated;
