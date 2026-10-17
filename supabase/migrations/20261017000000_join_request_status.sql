-- 참여 요청에 상태 추가: 거절해도 지우지 않고 'rejected'로 남긴다
--
-- 지금까지는 방장이 거절하면 요청이 지워져서, 요청한 사람이 같은 링크를 다시 열면 처음 온 사람처럼 보였다.
-- 이제 거절된 요청은 요청한 사람에게만 "거절됨"으로 남고(방장 화면에서는 사라짐), 다시 요청하면 대기 중으로 바뀐다.
--
-- 적용 순서: 새 앱(거절 상태를 아는 앱)을 먼저 배포한 뒤에 이 SQL을 실행한다.
--   예전 앱에서 이걸 먼저 적용하면 거절된 요청이 "승인 요청중"으로 계속 보인다.
-- 새 앱은 이 SQL 적용 전에도 동작한다(status가 없으면 대기 중으로 본다).

-- ============================================================
-- 1. 상태 컬럼
-- ============================================================

alter table public.join_requests
  add column if not exists status text not null default 'pending' check (status in ('pending', 'rejected'));

-- ============================================================
-- 2. 요청: 거절된 요청이 있으면 새 대기 요청으로 바꾸고 방장에게 다시 알린다
-- ============================================================

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

  -- 대기 중이던 요청을 바꾸는 경우만 알림을 또 만들지 않는다. 거절된 뒤 다시 요청하면 방장에게 다시 알린다.
  select exists (
    select 1 from public.join_requests
     where group_id = g.id and (user_id = auth.uid() or guest_uid = auth.uid()) and status = 'pending'
  ) into had_request;
  delete from public.join_requests
   where group_id = g.id and (user_id = auth.uid() or guest_uid = auth.uid());

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
-- 3. 목록: status를 함께 돌려준다. 방장에게는 대기 중인 요청만
-- ============================================================
-- 돌려주는 컬럼이 바뀌어 create or replace로는 안 되므로 지우고 다시 만든다

drop function if exists public.list_join_requests();

create function public.list_join_requests()
returns table (
  id uuid,
  group_id uuid,
  group_name text,
  name text,
  member_id uuid,
  member_name text,
  is_guest boolean,
  mine boolean,
  created_at timestamptz,
  status text
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
    r.created_at,
    r.status
  from public.join_requests r
  join public.groups g on g.id = r.group_id
  left join public.members m on m.id = r.member_id
  left join public.profiles p on p.id = m.user_id
  where auth.uid() in (r.user_id, r.guest_uid)
     or (public.is_group_owner(r.group_id) and r.status = 'pending')
  order by r.created_at
$$;

revoke all on function public.list_join_requests() from public, anon;
grant execute on function public.list_join_requests() to authenticated;

-- ============================================================
-- 4. 승인: 대기 중인 요청만
-- ============================================================

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
  select * into r from public.join_requests where id = p_request_id and status = 'pending' for update;
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


-- ============================================================
-- 5. 거절: 지우지 않고 'rejected'로 남긴다
-- ============================================================

create or replace function public.reject_join_request(p_request_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  gid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select group_id into gid from public.join_requests where id = p_request_id and status = 'pending';
  if not found then raise exception 'request not found'; end if;
  if not public.is_group_owner(gid) then raise exception 'only the owner can review join requests'; end if;
  update public.join_requests set status = 'rejected' where id = p_request_id;
end
$$;
