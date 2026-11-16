-- 그룹 통화 (KRW / USD). 그룹 상세 헤더의 "이 여행에서 총 사용한 금액" 줄 오른쪽에서 고른다.
-- 금액 컬럼(expenses.amount, expense_participants.share_amount)은 그대로 bigint이고, 통화의 최소 단위로 읽는다:
-- KRW는 원, USD는 센트($12.34 = 1234). 그래서 기존 데이터·정산 계산은 바뀌지 않는다(모든 기존 그룹은 KRW).
--
-- 앱과의 순서: 앱이 먼저 배포돼도 괜찮다 — 이 SQL 전에는 앱이 모든 그룹을 KRW로 보고, 통화를 바꾸려 하면
-- "서버 업데이트 뒤에 쓸 수 있어요"라고 안내한다. 이 SQL을 실행하면 바로 USD를 고를 수 있다.

-- ============================================================
-- 1. groups.currency
-- ============================================================
alter table public.groups
  add column if not exists currency text not null default 'KRW'
  constraint groups_currency_check check (currency in ('KRW', 'USD'));

-- ============================================================
-- 2. 통화 바꾸기: 그룹 멤버(게스트 포함) 누구나, 단 지출이 하나도 없을 때만
--    (금액이 최소 단위로 저장돼서, 지출이 있는데 통화만 바꾸면 ₩10,000이 $100.00이 되어 버린다)
-- ============================================================
create or replace function public.set_group_currency(p_group_id uuid, p_currency text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_currency not in ('KRW', 'USD') then raise exception 'invalid currency'; end if;
  if not exists (
    select 1 from public.members
     where group_id = p_group_id and (user_id = auth.uid() or guest_uid = auth.uid())
  ) then
    raise exception 'not a group member';
  end if;
  -- 동시에 지출이 추가되는 것과 겹치지 않게 그룹 행을 잠그고 확인한다
  perform 1 from public.groups where id = p_group_id for update;
  if exists (select 1 from public.expenses where group_id = p_group_id) then
    raise exception 'group has expenses';
  end if;
  update public.groups set currency = p_currency where id = p_group_id;
end
$$;
revoke all on function public.set_group_currency(uuid, text) from public, anon;
grant execute on function public.set_group_currency(uuid, text) to authenticated;

-- ============================================================
-- 3. 지출 삭제 알림 문구의 금액을 그룹 통화로 (₩30,000 / $12.34)
--    20261005000000_expense_deleted_notification.sql의 함수와 금액 부분만 다르다.
--    app/src/domain/notifications.ts 의 expenseDeletedTitle 과 같아야 한다.
-- ============================================================
create or replace function public.notify_expense_deleted() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  gname text;
  gcurrency text;
  deleter_id uuid;
  deleter text;
  payer text;
  item text;
  money text;
begin
  -- 그룹이 통째로 지워지는 중이면(지출이 함께 삭제됨) 알림을 남길 그룹이 없다
  select name, currency into gname, gcurrency from public.groups where id = old.group_id;
  if not found then return old; end if;

  -- 지운 사람: 지금 요청한 사람의 이 그룹 멤버 행. 못 찾으면(대시보드·관리용 SQL로 지운 경우 등) 알림을 만들지 않는다
  select m.id, coalesce(p.name, m.name, '') into deleter_id, deleter
    from public.members m
    left join public.profiles p on p.id = m.user_id
   where m.group_id = old.group_id and (m.user_id = auth.uid() or m.guest_uid = auth.uid())
   limit 1;
  if deleter_id is null then return old; end if;

  select coalesce(p.name, m.name, '') into payer
    from public.members m
    left join public.profiles p on p.id = m.user_id
   where m.id = old.paid_by;

  item := case when char_length(old.title) > 30 then left(old.title, 30) || '…' else old.title end;

  money := case
    when gcurrency = 'USD' then '$' || to_char(old.amount / 100.0, 'FM999,999,999,999,990.00')
    else '₩' || to_char(old.amount, 'FM999,999,999,999,999')
  end;

  insert into public.notifications (group_id, member_id, type, title)
  values (
    old.group_id,
    deleter_id,
    'expense_deleted',
    '[' || gname || ']에서 ''' || item || ''' 내역(' || money
      || ', 결제: ' || case when coalesce(payer, '') = '' then '알 수 없음' else payer end || ')을 '
      || case when deleter = '' then '누군가' else deleter end || '님이 삭제했어요'
  );
  return old;
end
$$;

revoke all on function public.notify_expense_deleted() from public, anon, authenticated;
