-- 그룹장이 탈퇴해도 그룹에 새 사람이 들어올 수 있게 한다. (20261017000100_guest_approve_once.sql 다음에 실행)
--
-- 1) 그룹장이 탈퇴하면 그 그룹에 남은 회원 중 가장 먼저 들어온 사람이 새 그룹장이 된다.
-- 2) 남은 회원이 없으면(비회원만 남음) 그룹장 없는 그룹이 되고, 그 그룹은 승인 없이 바로 참여한다.
--    이때 회원이 들어오면 그 사람이 새 그룹장이 된다. 승인을 기다리던 요청은 지워서 다시 링크로 들어오게 한다.
-- 3) 이미 그룹장이 탈퇴해 그룹장이 없는 그룹도 이 SQL을 실행할 때 같은 규칙으로 정리한다.
-- 앱 배포 전후 어느 쪽에 실행해도 안전하다.

-- ============================================================
-- 1. 그룹장 넘기기 (내부용)
-- ============================================================
-- 지금 그룹장을 내리고, p_leaving을 뺀 회원 중 가장 먼저 들어온 사람을 그룹장으로. 회원이 없으면 그룹장 없음.
-- 그룹장이 없어진 그룹의 대기 중 요청은 지운다(승인할 사람이 없음 — 다시 들어오면 바로 참여).

create or replace function public.hand_over_owner(p_group_id uuid, p_leaving uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  next_owner uuid;
begin
  select id into next_owner from public.members
   where group_id = p_group_id and user_id is not null and user_id is distinct from p_leaving
   order by joined_at, id
   limit 1;

  -- 그룹당 그룹장은 한 명(members_one_owner_per_group)이라 먼저 내리고 올린다
  update public.members set role = 'member' where group_id = p_group_id and role = 'owner';
  if next_owner is not null then
    update public.members set role = 'owner' where id = next_owner;
  else
    delete from public.join_requests where group_id = p_group_id and status = 'pending';
  end if;
end
$$;

revoke all on function public.hand_over_owner(uuid, uuid) from public, anon, authenticated;

-- ============================================================
-- 2. 탈퇴: 내가 그룹장인 그룹은 먼저 넘긴다
-- ============================================================

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = ''
as $$
declare
  gid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if public.is_anonymous_user() then raise exception 'guests cannot delete accounts'; end if;

  for gid in select group_id from public.members where user_id = auth.uid() and role = 'owner' loop
    perform public.hand_over_owner(gid, auth.uid());
  end loop;

  delete from auth.users where id = auth.uid();
end
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ============================================================
-- 3. 참여 요청: 그룹장 없는 그룹은 바로 참여
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
  slot_guest uuid;
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
    select name, guest_uid into slot_name, slot_guest from public.members
     where id = p_member_id and group_id = g.id and user_id is null;
    if not found then raise exception 'member not available'; end if;

    -- 이미 승인된 게스트 자리: 승인은 한 번이면 충분하다. 개인 초대 링크로 오면 다른 기기·브라우저여도 바로 그 자리로 들어간다
    --   게스트면 그 자리를 이 세션으로 옮기고, 로그인했으면 그 자리를 계정에 연결한다(게스트 → 회원 전환)
    if slot_guest is not null then
      delete from public.join_requests
       where group_id = g.id and (user_id = auth.uid() or guest_uid = auth.uid());
      if anon then
        update public.members set guest_uid = auth.uid() where id = p_member_id;
      else
        if not exists (select 1 from public.profiles where id = auth.uid()) then raise exception 'profile required'; end if;
        update public.members
           set user_id = auth.uid(), guest_uid = null, name = null, joined_at = now()
         where id = p_member_id;
      end if;
      return p_member_id;
    end if;
  end if;

  if anon then
    req_name := coalesce(slot_name, btrim(coalesce(p_name, '')));
    if req_name = '' then raise exception 'name required for guests'; end if;
  else
    select name into req_name from public.profiles where id = auth.uid();
    if req_name is null then raise exception 'profile required'; end if;
  end if;

  -- 그룹장이 없는 그룹(그룹장이 탈퇴했고 남은 회원도 없음): 승인할 사람이 없으니 바로 참여한다.
  --   회원이 들어오면 그 사람이 새 그룹장이 된다
  if not exists (select 1 from public.members where group_id = g.id and role = 'owner') then
    delete from public.join_requests
     where group_id = g.id and (user_id = auth.uid() or guest_uid = auth.uid());
    if anon then
      if p_member_id is not null then
        update public.members set guest_uid = auth.uid() where id = p_member_id returning id into mid;
      else
        insert into public.members (group_id, guest_uid, name) values (g.id, auth.uid(), req_name) returning id into mid;
      end if;
    else
      if p_member_id is not null then
        update public.members
           set user_id = auth.uid(), guest_uid = null, name = null, joined_at = now()
         where id = p_member_id
        returning id into mid;
      else
        insert into public.members (group_id, user_id) values (g.id, auth.uid()) returning id into mid;
      end if;
      perform public.hand_over_owner(g.id, null);
    end if;
    insert into public.notifications (group_id, member_id, type, title)
    values (g.id, mid, 'member_joined', req_name || '님이 [' || g.name || '] 그룹에 참여했어요');
    return mid;
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
-- 4. 이미 그룹장이 탈퇴한 그룹 정리 (한 번만)
-- ============================================================

select public.hand_over_owner(g.id, null)
  from public.groups g
 where not exists (
   select 1 from public.members m where m.group_id = g.id and m.role = 'owner' and m.user_id is not null
 );
