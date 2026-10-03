-- 보안 강화 1/2 (추가만 하는 안전한 단계 — 이걸 먼저 적용하고, 앱을 배포한 뒤에 2/2를 적용한다)
--
-- 1) 계좌번호를 profiles 테이블에서 직접 읽지 않고 함수로만 읽게 할 준비
--      get_my_profile()      : 내 이름·은행·계좌 (본인 것만)
--      get_payee_accounts()  : "돈을 받을 수 있는 사람"의 은행·계좌만 — 내가 속한 그룹에서 지출을 한 번이라도
--                              결제한 정식 회원. 정산에서 받는 쪽은 반드시 결제한 사람이므로 정산 화면에 필요한 건 이게 전부다.
--    (profiles의 bank/account 직접 조회를 막는 건 2/2 파일. 앱이 이 함수를 쓰도록 바뀐 뒤에 막아야 안 깨진다)
-- 2) 가입할 때 넘긴 계좌번호가 로그인 정보(auth.users 메타데이터)와 토큰에도 복사되어 남던 문제 정리
-- 3) 초대코드 재발급 — 코드가 새어 나갔을 때 방장이 끊을 수 있게 함

-- ============================================================
-- 1. 계좌 조회 함수
-- ============================================================

create or replace function public.get_my_profile()
returns table (id uuid, name text, bank text, account text, seen_group_create_coach boolean)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.name, p.bank, p.account, p.seen_group_create_coach
  from public.profiles p
  where p.id = auth.uid()
$$;

create or replace function public.get_payee_accounts()
returns table (user_id uuid, bank text, account text)
language sql stable security definer set search_path = ''
as $$
  select distinct p.id, p.bank, p.account
  from public.expenses e
  join public.members payer on payer.id = e.paid_by          -- 결제한 멤버 (지출과 같은 그룹임은 복합 FK가 보장)
  join public.profiles p on p.id = payer.user_id             -- 정식 회원만 (게스트·대기 중은 계좌가 없음)
  where exists (                                              -- 그리고 나도 그 그룹의 멤버(정식 회원 또는 게스트)
    select 1 from public.members me
    where me.group_id = e.group_id and (me.user_id = auth.uid() or me.guest_uid = auth.uid())
  )
$$;

revoke all on function public.get_my_profile() from public, anon;
revoke all on function public.get_payee_accounts() from public, anon;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.get_payee_accounts() to authenticated;

-- ============================================================
-- 2. 가입 트리거: 계좌번호를 profiles에만 남기고 auth 메타데이터에서는 지운다
-- ============================================================

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.is_anonymous then
    return new;
  end if;

  insert into public.profiles (id, name, bank, account)
  values (
    new.id,
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'bank',
    new.raw_user_meta_data ->> 'account'
  );

  -- 앱이 가입 요청에 실어 보낸 은행·계좌번호는 위에서 profiles로 옮겼으니 로그인 정보 쪽 사본은 지운다.
  -- (남겨 두면 프로필에서 계좌를 고쳐도 옛 번호가 계속 남고, 로그인 토큰에도 실려 다닌다)
  update auth.users
     set raw_user_meta_data = raw_user_meta_data - 'bank' - 'account'
   where id = new.id;

  return new;
end
$$;

-- 이미 가입한 회원들에게 남아 있는 사본도 한 번 정리 (여러 번 실행해도 안전)
update auth.users
   set raw_user_meta_data = raw_user_meta_data - 'bank' - 'account'
 where raw_user_meta_data ?| array['bank', 'account'];

-- ============================================================
-- 3. 초대코드 재발급 (방장 전용)
-- ============================================================
-- 새 코드가 만들어지면 이전 코드와 그 코드로 만든 개인 초대 링크는 즉시 못 쓴다. 이미 참여한 멤버에게는 영향이 없다.

create or replace function public.rotate_invite_code(p_group_id uuid) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  new_code text;
  tries int := 0;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if public.is_anonymous_user() then raise exception 'guests cannot rotate invite codes'; end if;
  if not public.is_group_owner(p_group_id) then raise exception 'only the owner can rotate the invite code'; end if;

  loop
    begin
      update public.groups set invite_code = public.gen_invite_code()
       where id = p_group_id
      returning invite_code into new_code;
      exit;
    exception when unique_violation then
      tries := tries + 1;
      if tries >= 5 then raise; end if;
    end;
  end loop;

  return new_code;
end
$$;

revoke all on function public.rotate_invite_code(uuid) from public, anon;
grant execute on function public.rotate_invite_code(uuid) to authenticated;
