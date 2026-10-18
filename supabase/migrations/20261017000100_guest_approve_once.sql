-- 비회원(게스트) 정리 — 앱 배포 전후 어느 쪽에 실행해도 안전하다. (20261017000000_join_request_status.sql 다음에 실행)
--
-- 1) 승인은 한 번만: 이미 승인된 게스트 자리의 개인 초대 링크로 오면 다른 기기·브라우저여도 승인 없이 바로 들어간다.
--    링크만 있으면 들어올 수 있게 되는 대신, 2)로 계좌번호는 게스트에게 보여주지 않는다.
-- 2) 계좌번호는 정식 회원(user_id)으로 그룹에 속한 사람에게만. 게스트에겐 앱이 "로그인하면 계좌번호를 볼 수 있어요"를 보여준다.

-- ============================================================
-- 1. 참여 요청: 승인된 게스트 자리는 바로 입장
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
-- 2. 계좌: 게스트 제외
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
