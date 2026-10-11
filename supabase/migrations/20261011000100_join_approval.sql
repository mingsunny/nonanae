-- 초대코드 참여에 방장 승인 추가 1/2 (추가만 하는 안전한 단계 — 새 앱을 배포하기 전에 먼저 적용)
--
-- 지금까지는 초대코드만 알면 바로 그룹 멤버가 되어 지출·정산(받을 사람 계좌번호 포함)을 볼 수 있었다.
-- 이제 참여는 "요청"만 남기고, 방장이 승인해야 실제 멤버가 된다. 로그인·가입·게스트·개인 초대 링크 모두 같다.
-- 이미 그 그룹 멤버인 계정(세션)이 다시 들어오는 재입장만 승인 없이 들어간다.
--
--   request_join()         : 참여 요청. 이미 멤버면 그 멤버 id를 돌려주고 끝(재입장), 아니면 요청을 남기고 null
--   list_join_requests()   : 내가 보낸 요청 + 내가 방장인 그룹에 들어온 요청
--   approve_join_request() : 방장 승인 → 이때 실제 멤버가 된다 (기존 join_group()이 하던 일)
--   reject_join_request()  : 방장 거절 → 요청 삭제
--   cancel_join_request()  : 요청한 사람이 취소
--
-- 예전 join_group()(승인 없이 바로 참여)은 2/2 파일(20261011000200)에서 막는다 — 앱이 새 버전으로 배포된 뒤에.

-- ============================================================
-- 1. 참여 요청 테이블
-- ============================================================
-- 클라이언트는 이 테이블을 직접 읽고 쓰지 못한다. 위 함수들로만 다룬다.

create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  -- 요청한 사람: 정식 회원(user_id) 또는 게스트 익명 세션(guest_uid) 중 하나
  user_id uuid references public.profiles (id) on delete cascade,
  guest_uid uuid references auth.users (id) on delete cascade,
  -- "이게 나예요"로 고른 자리(대기 중 멤버/게스트 자리). 새 멤버로 참여하면 null
  member_id uuid references public.members (id) on delete cascade,
  -- 방장에게 보여줄 이름. 요청 시점에 고정 (회원: 프로필 이름, 게스트: 입력한 이름 또는 고른 자리의 이름)
  name text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now(),
  constraint join_requests_one_requester check ((user_id is null) <> (guest_uid is null))
);
-- 한 사람은 한 그룹에 요청 하나만 (다시 요청하면 이전 요청을 바꾼다)
create unique index join_requests_group_user_uniq on public.join_requests (group_id, user_id) where user_id is not null;
create unique index join_requests_group_guest_uniq on public.join_requests (group_id, guest_uid) where guest_uid is not null;

alter table public.join_requests enable row level security;
revoke all on public.join_requests from anon, authenticated;

-- ============================================================
-- 2. 알림 종류에 join_request 추가 (방장이 요청을 알 수 있게)
-- ============================================================

do $$
declare
  c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.notifications'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%member_joined%'
  loop
    execute format('alter table public.notifications drop constraint %I', c.conname);
  end loop;
end
$$;

alter table public.notifications
  add constraint notifications_type_check
  check (type in ('expense', 'member_joined', 'expense_deleted', 'join_request'));

-- ============================================================
-- 3. 참여 요청
-- ============================================================
--   p_member_id 있음: 그 자리(user_id 없는 대기 중/게스트 자리)로 들어가겠다는 요청
--   p_member_id 없음: 새 멤버로 들어가겠다는 요청 (게스트는 p_name 필수)
-- 같은 사람이 다시 요청하면 이전 요청을 새 내용으로 바꾼다. 방장 알림은 처음 요청할 때만 만든다.

create or replace function public.request_join(p_code text, p_member_id uuid default null, p_name text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  g public.groups;
  mid uuid;
  anon boolean := public.is_anonymous_user();
  slot_name text;
  req_name text;
  had_request boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into g from public.groups where invite_code = upper(btrim(p_code));
  if not found then raise exception 'invalid invite code'; end if;

  -- 이미 이 그룹 멤버면 재입장 — 승인 없이 그대로
  select id into mid from public.members
   where group_id = g.id and (user_id = auth.uid() or guest_uid = auth.uid());
  if found then return mid; end if;

  if p_member_id is not null then
    select name into slot_name from public.members
     where id = p_member_id and group_id = g.id and user_id is null;
    if not found then raise exception 'member not available'; end if;
  end if;

  if anon then
    req_name := coalesce(slot_name, btrim(coalesce(p_name, '')));
    if req_name = '' then raise exception 'name required for guests'; end if;
  else
    select name into req_name from public.profiles where id = auth.uid();
    if req_name is null then raise exception 'profile required'; end if;
  end if;

  delete from public.join_requests
   where group_id = g.id and (user_id = auth.uid() or guest_uid = auth.uid());
  had_request := found;

  insert into public.join_requests (group_id, user_id, guest_uid, member_id, name)
  values (
    g.id,
    case when anon then null else auth.uid() end,
    case when anon then auth.uid() else null end,
    p_member_id,
    req_name
  );

  if not had_request then
    insert into public.notifications (group_id, member_id, type, title)
    values (g.id, null, 'join_request', req_name || '님이 [' || g.name || '] 그룹에 참여를 요청했어요');
  end if;

  return null;
end
$$;

-- ============================================================
-- 4. 요청 목록 — 내가 보낸 것 + 내가 방장인 그룹에 들어온 것
-- ============================================================

create or replace function public.list_join_requests()
returns table (
  id uuid,
  group_id uuid,
  group_name text,
  name text,
  member_id uuid,
  member_name text,
  is_guest boolean,
  mine boolean,
  created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select
    r.id,
    r.group_id,
    g.name,
    r.name,
    r.member_id,
    coalesce(m.name, p.name),
    r.guest_uid is not null,
    coalesce(auth.uid() in (r.user_id, r.guest_uid), false),
    r.created_at
  from public.join_requests r
  join public.groups g on g.id = r.group_id
  left join public.members m on m.id = r.member_id
  left join public.profiles p on p.id = m.user_id
  where auth.uid() in (r.user_id, r.guest_uid) or public.is_group_owner(r.group_id)
  order by r.created_at
$$;

-- ============================================================
-- 5. 방장 승인 / 거절, 요청자 취소
-- ============================================================

-- 승인: 기존 join_group()이 하던 일을 방장이 대신 실행한다. 참여 알림 규칙도 그대로
-- (새 멤버가 생기거나 정식 회원이 자리를 채우면 알림, 게스트가 기존 자리를 다시 고른 재입장은 알림 없음).
create or replace function public.approve_join_request(p_request_id uuid) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  r public.join_requests;
  g public.groups;
  requester uuid;
  mid uuid;
  pname text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into r from public.join_requests where id = p_request_id for update;
  if not found then raise exception 'request not found'; end if;
  if not public.is_group_owner(r.group_id) then raise exception 'only the owner can review join requests'; end if;
  select * into g from public.groups where id = r.group_id;
  requester := coalesce(r.user_id, r.guest_uid);

  -- 요청한 뒤 이미 멤버가 됐으면 요청만 정리
  select id into mid from public.members
   where group_id = r.group_id and (user_id = requester or guest_uid = requester);
  if found then
    delete from public.join_requests where id = r.id;
    return mid;
  end if;

  if r.guest_uid is not null then
    if r.member_id is not null then
      update public.members set guest_uid = r.guest_uid
       where id = r.member_id and group_id = r.group_id and user_id is null
      returning id into mid;
      if not found then raise exception 'member not available'; end if;
      delete from public.join_requests where id = r.id;
      return mid;
    end if;
    insert into public.members (group_id, guest_uid, name) values (r.group_id, r.guest_uid, r.name)
    returning id into mid;
    pname := r.name;
  else
    if r.member_id is not null then
      update public.members
         set user_id = r.user_id, guest_uid = null, name = null, joined_at = now()
       where id = r.member_id and group_id = r.group_id and user_id is null
      returning id into mid;
      if not found then raise exception 'member not available'; end if;
    else
      insert into public.members (group_id, user_id) values (r.group_id, r.user_id) returning id into mid;
    end if;
    select name into pname from public.profiles where id = r.user_id;
  end if;

  insert into public.notifications (group_id, member_id, type, title)
  values (g.id, mid, 'member_joined', pname || '님이 [' || g.name || '] 그룹에 참여했어요');

  delete from public.join_requests where id = r.id;
  return mid;
end
$$;

create or replace function public.reject_join_request(p_request_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  gid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select group_id into gid from public.join_requests where id = p_request_id;
  if not found then raise exception 'request not found'; end if;
  if not public.is_group_owner(gid) then raise exception 'only the owner can review join requests'; end if;
  delete from public.join_requests where id = p_request_id;
end
$$;

create or replace function public.cancel_join_request(p_group_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from public.join_requests
   where group_id = p_group_id and (user_id = auth.uid() or guest_uid = auth.uid());
end
$$;

-- ============================================================
-- 6. 실행 권한
-- ============================================================

revoke all on function public.request_join(text, uuid, text) from public, anon;
revoke all on function public.list_join_requests() from public, anon;
revoke all on function public.approve_join_request(uuid) from public, anon;
revoke all on function public.reject_join_request(uuid) from public, anon;
revoke all on function public.cancel_join_request(uuid) from public, anon;

grant execute on function public.request_join(text, uuid, text) to authenticated;
grant execute on function public.list_join_requests() to authenticated;
grant execute on function public.approve_join_request(uuid) to authenticated;
grant execute on function public.reject_join_request(uuid) to authenticated;
grant execute on function public.cancel_join_request(uuid) to authenticated;
