-- 게스트(로그인 없이 이름만으로 참여) 지원 — 20260920000000_init_schema.sql 다음에 실행
--
-- 방식: Supabase 익명 로그인(anonymous sign-in)
--   * 게스트는 앱에서 supabase.auth.signInAnonymously()로 익명 세션을 받음 (auth.users에 익명 행이 생기지만 profiles는 안 만듦)
--   * 그 세션 id(auth.uid())를 members.guest_uid에 저장해서 "이 세션 = 이 멤버"로 인식. 스펙대로 User 계정은 만들지 않고,
--     PIN 같은 재입장 인증도 없음
--   * 재입장(기기 변경/브라우저 데이터 삭제): 새 익명 세션으로 06/07 화면에서 같은 이름을 다시 고르면 guest_uid가 새 세션으로 넘어옴
--     (스푸핑 방지 장치 없음 — 스펙에서 수용한 트레이드오프)
--   * 게스트 -> 정식 회원 전환(기록 이관)은 지원하지 않음: 게스트는 일반 로그인/회원가입만 쓰고, 게스트 기록은 옮기지 않음
--
-- 사전 설정: Supabase 대시보드 > Authentication > Sign In / Providers > "Allow anonymous sign-ins" 켜기
--            (익명 계정은 무제한 생성될 수 있으니 실서비스 전에 CAPTCHA/레이트리밋 설정 권장)

-- ============================================================
-- 1. members.guest_uid
-- ============================================================

alter table public.members
  add column guest_uid uuid references auth.users (id) on delete set null;

-- 정식 회원 연결(user_id)과 게스트 세션 연결(guest_uid)은 동시에 가질 수 없음
alter table public.members
  add constraint members_not_both_user_and_guest check (user_id is null or guest_uid is null);

-- 한 익명 세션은 한 그룹에서 멤버 한 명으로만 존재
create unique index members_group_guest_uid_uniq on public.members (group_id, guest_uid) where guest_uid is not null;
create index members_guest_uid_idx on public.members (guest_uid) where guest_uid is not null;

-- ============================================================
-- 2. 가입 트리거 — 익명 로그인은 profiles를 만들지 않음
--    (안 걸러주면 name/bank/account가 없어서 익명 로그인 자체가 실패함)
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
  return new;
end
$$;

-- ============================================================
-- 3. 권한 헬퍼 — 게스트 세션도 "내 멤버"로 인식
-- ============================================================

create or replace function public.is_anonymous_user() returns boolean
language sql stable set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

create or replace function public.is_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members
    where group_id = gid and (user_id = auth.uid() or guest_uid = auth.uid())
  )
$$;

-- 게스트도 정산 화면에서 같은 그룹 멤버의 은행/계좌를 봐야 하므로(내가 보낼 송금) 프로필 조회 범위에 포함
create or replace function public.shares_group_with(uid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.members a
    join public.members b on b.group_id = a.group_id
    where (a.user_id = auth.uid() or a.guest_uid = auth.uid()) and b.user_id = uid
  )
$$;

-- 멤버 추가 정책: 참여/그룹장 지정은 RPC로만 — guest_uid를 임의로 지정해 남의 자리를 선점하지 못하게 막음
drop policy members_insert_placeholder on public.members;
create policy members_insert_placeholder on public.members for insert to authenticated
  with check (
    public.is_group_member(group_id)
    and user_id is null and guest_uid is null
    and role = 'member' and name is not null
  );

-- ============================================================
-- 4. RPC
-- ============================================================

-- 05 새 그룹 만들기: 그룹장은 정식 회원만 (게스트는 익명 세션이라 거부)
create or replace function public.create_group(p_name text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  gid uuid;
  tries int := 0;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if public.is_anonymous_user() then raise exception 'guests cannot create groups'; end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then raise exception 'group name required'; end if;

  loop
    begin
      insert into public.groups (name) values (btrim(p_name)) returning id into gid;
      exit;
    exception when unique_violation then
      tries := tries + 1;
      if tries >= 5 then raise; end if;
    end;
  end loop;

  insert into public.members (group_id, user_id, role) values (gid, auth.uid(), 'owner');
  return gid;
end
$$;

-- 06/07 초대코드로 참여 — 정식 회원과 게스트(익명 세션) 공용
--   p_member_id 있음: 그 자리(user_id 없는 placeholder/게스트)를 내 것으로 삼음
--     - 정식 회원: user_id를 채움 (기존 guest_uid는 비움)
--     - 게스트:    guest_uid를 내 세션으로 교체 (재입장)
--   p_member_id 없음: 새 멤버로 추가 (게스트는 p_name 필수)
-- 이미 이 그룹 멤버면 기존 멤버 id를 그대로 돌려줌.
-- 참여 알림은 "새 멤버가 생기거나 정식 회원이 자리를 채울 때"만 생성 (게스트가 기존 자리를 다시 고르는 재입장은 알림 없음 — 프로토타입 동작과 동일)
drop function public.join_group(text, uuid);

create or replace function public.join_group(p_code text, p_member_id uuid default null, p_name text default null) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  g public.groups;
  mid uuid;
  pname text;
  anon boolean := public.is_anonymous_user();
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into g from public.groups where invite_code = upper(btrim(p_code));
  if not found then raise exception 'invalid invite code'; end if;

  select id into mid from public.members
   where group_id = g.id and (user_id = auth.uid() or guest_uid = auth.uid());
  if found then return mid; end if;

  if anon then
    if p_member_id is not null then
      update public.members set guest_uid = auth.uid()
       where id = p_member_id and group_id = g.id and user_id is null
      returning id into mid;
      if not found then raise exception 'member not available'; end if;
      return mid;
    end if;

    pname := btrim(coalesce(p_name, ''));
    if pname = '' then raise exception 'name required for guests'; end if;
    insert into public.members (group_id, guest_uid, name) values (g.id, auth.uid(), pname)
    returning id into mid;
  else
    if p_member_id is not null then
      update public.members
         set user_id = auth.uid(), guest_uid = null, name = null, joined_at = now()
       where id = p_member_id and group_id = g.id and user_id is null
      returning id into mid;
      if not found then raise exception 'member not available'; end if;
    else
      insert into public.members (group_id, user_id) values (g.id, auth.uid()) returning id into mid;
    end if;
    select name into pname from public.profiles where id = auth.uid();
  end if;

  insert into public.notifications (group_id, member_id, type, title)
  values (g.id, mid, 'member_joined', pname || '님이 [' || g.name || '] 그룹에 참여했어요');

  return mid;
end
$$;

-- ============================================================
-- 5. 실행 권한
-- ============================================================

revoke all on function public.is_anonymous_user() from public, anon;
revoke all on function public.join_group(text, uuid, text) from public, anon;

grant execute on function public.is_anonymous_user() to authenticated;
grant execute on function public.join_group(text, uuid, text) to authenticated;
