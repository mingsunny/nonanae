-- 참여 정책 정리 (20261017000000_join_request_status.sql 다음에 실행. 추가·교체만 하는 단계라 앱 배포 전후 어느 쪽이든 안전)
--
-- 이 파일은 20261017000100_guest_approve_once / 20261017000200_owner_handover 를 대신한다(그 두 파일은 서버에 적용된 적이 없고, 지웠다).
-- 그 파일들의 request_join()에는 "이미 승인된 게스트 자리를 지정하면 승인 없이 바로 입장" 지름길이 있었다. 자리 ID는 초대코드만 알면
-- lookup_group_by_code()로 얻을 수 있어서, 코드를 아는 누구든 방장 승인 없이 그 자리를 가로챌 수 있었다(정식 회원이면 계좌번호까지 열림).
-- 그래서 지름길은 넣지 않는다. 게스트 자리를 쓰려면 언제나 방장 승인이 필요하다.
--
-- 담은 것
--   1) 계좌번호는 정식 회원에게만 (get_payee_accounts에서 게스트 제외)
--   2) 그룹장 탈퇴 시 남은 회원 중 가장 먼저 들어온 정식 회원에게 그룹장을 넘긴다 (hand_over_owner, delete_my_account)
--   3) 그룹장 없는 그룹(그룹장이 탈퇴했고 남은 정식 회원도 없음): **정식 회원이 들어올 때만** 승인 없이 바로 참여하고, 그 사람이 새 그룹장이 된다.
--      비회원(게스트)은 그대로 참여 요청만 남기고, 그룹장이 생긴 뒤에 승인받는다. 이미 게스트가 차지한 자리는 바로 가져갈 수 없다.
--   4) 이미 그룹장이 없는 그룹을 같은 규칙으로 한 번 정리

-- ============================================================
-- 1. 계좌: 게스트 제외
-- ============================================================

create or replace function public.get_payee_accounts()
returns table (user_id uuid, bank text, account text)
language sql stable security definer set search_path = ''
as $$
  select distinct p.id, p.bank, p.account
  from public.expenses e
  join public.members payer on payer.id = e.paid_by          -- 결제한 멤버 (지출과 같은 그룹임은 복합 FK가 보장)
  join public.profiles p on p.id = payer.user_id             -- 정식 회원만 (게스트·대기 중은 계좌가 없음)
  where exists (                                              -- 그리고 나도 그 그룹의 정식 회원 (게스트 제외)
    select 1 from public.members me
    where me.group_id = e.group_id and me.user_id = auth.uid()
  )
$$;

-- ============================================================
-- 2. 그룹장 넘기기 (내부용)
-- ============================================================
-- 지금 그룹장을 내리고, p_leaving을 뺀 정식 회원 중 가장 먼저 들어온 사람을 그룹장으로 올린다. 없으면 그룹장 없는 그룹.
-- 대기 중이던 참여 요청은 그대로 둔다 — 새 그룹장이 생기면 그 사람이 처리한다.

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
  end if;
end
$$;

revoke all on function public.hand_over_owner(uuid, uuid) from public, anon, authenticated;

-- ============================================================
-- 3. 탈퇴: 내가 그룹장인 그룹은 먼저 넘긴다
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
-- 4. 참여 요청
-- ============================================================
--   p_member_id 있음: 그 자리(user_id 없는 대기 중 멤버/게스트 자리)로 들어가겠다는 요청
--   p_member_id 없음: 새 멤버로 들어가겠다는 요청 (게스트는 p_name 필수)
-- 이미 이 그룹 멤버면(재입장) 그 멤버 id를 돌려주고, 아니면 요청만 남기고 null. 정식 회원이 그룹장 없는 그룹에 들어올 때만 바로 멤버가 된다.

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
  -- 같은 그룹에 동시에 들어오는 요청이 서로의 "그룹장이 있는지" 판단에 끼어들지 않게 그룹 행을 잠근다
  select * into g from public.groups where invite_code = upper(btrim(p_code)) for update;
  if not found then raise exception 'invalid invite code'; end if;

  -- 이미 이 그룹 멤버면 재입장 — 승인 없이 그대로
  select id into mid from public.members
   where group_id = g.id and (user_id = auth.uid() or guest_uid = auth.uid());
  if found then return mid; end if;

  if p_member_id is not null then
    select name, guest_uid into slot_name, slot_guest from public.members
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

  -- 그룹장이 없는 그룹(그룹장이 탈퇴했고 남은 정식 회원도 없음): 승인할 사람이 없으니 **정식 회원**은 바로 참여하고 새 그룹장이 된다.
  -- 게스트는 바로 들어올 수 없다(요청만 남김). 이미 게스트가 차지한 자리도 바로 가져갈 수 없다.
  if not anon and slot_guest is null
     and not exists (select 1 from public.members where group_id = g.id and role = 'owner') then
    delete from public.join_requests where group_id = g.id and user_id = auth.uid();
    if p_member_id is not null then
      update public.members
         set user_id = auth.uid(), guest_uid = null, name = null, joined_at = now()
       where id = p_member_id
      returning id into mid;
    else
      insert into public.members (group_id, user_id) values (g.id, auth.uid()) returning id into mid;
    end if;
    perform public.hand_over_owner(g.id, null);
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
-- 5. 이미 그룹장이 탈퇴한 그룹 정리 (한 번만)
-- ============================================================

select public.hand_over_owner(g.id, null)
  from public.groups g
 where not exists (
   select 1 from public.members m where m.group_id = g.id and m.role = 'owner' and m.user_id is not null
 );
