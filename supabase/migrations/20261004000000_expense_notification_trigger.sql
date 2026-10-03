-- 지출 등록 알림을 서버가 만들게 하고, 지출이 있는 그룹을 못 지우던 결함을 고친다. (추가형 — 지금 앱과 함께 써도 안전)
--
-- 1) 지출 등록 알림: 지금은 앱이 notifications 에 직접 넣어서, 같은 그룹 멤버(게스트 포함)가 임의 문구의
--    알림을 만들 수 있었다. 지출이 들어오면 DB 트리거가 문구까지 직접 만든다.
--    앱이 직접 넣는 코드는 이 SQL 다음 배포에서 빠지고, 그 뒤 20261004000100 이 직접 쓰기 권한을 닫는다.
--    (그 전까지 짧게는 알림이 두 번 생길 수 있다 — 적용 순서는 PR 설명 참고)
-- 2) 그룹 삭제: 그룹을 지우면 members·expenses 가 함께 지워지는데, expenses/expense_participants 가
--    members 를 가리키는 FK 가 "즉시 검사"라 지우는 순서에 따라 "아직 참조 중"으로 막혔다.
--    커밋 시점에 검사하도록 바꿔, 지출이 있는 그룹도 지워지게 한다.

-- ============================================================
-- 1. 지출 등록 알림 트리거
-- ============================================================

create or replace function public.notify_expense_added() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  gname text;
  payer text;
begin
  select name into gname from public.groups where id = new.group_id;
  select coalesce(p.name, m.name, '') into payer
    from public.members m
    left join public.profiles p on p.id = m.user_id
   where m.id = new.paid_by;

  -- 문구는 app/src/domain/notifications.ts 의 expenseAddedTitle 과 같아야 한다 (13 알림1: 등록자가 아니라 결제자 이름)
  insert into public.notifications (group_id, member_id, type, title)
  values (
    new.group_id,
    new.paid_by,
    'expense',
    '[' || coalesce(gname, '') || ']에 ' || case when payer = '' then '누군가' else payer end || '님이 결제한 내역이 추가됐어요'
  );
  return new;
end
$$;

revoke all on function public.notify_expense_added() from public, anon, authenticated;

drop trigger if exists expenses_notify_added on public.expenses;
create trigger expenses_notify_added
  after insert on public.expenses
  for each row execute function public.notify_expense_added();

-- ============================================================
-- 2. 지출이 있는 그룹도 지워지게: members 를 가리키는 FK 를 커밋 시점 검사로
-- ============================================================

do $$
declare
  c record;
begin
  for c in
    select conrelid::regclass as tbl, conname
      from pg_constraint
     where contype = 'f'
       and confrelid = 'public.members'::regclass
       and conrelid in ('public.expenses'::regclass, 'public.expense_participants'::regclass)
  loop
    execute format('alter table %s alter constraint %I deferrable initially deferred', c.tbl, c.conname);
  end loop;
end
$$;
