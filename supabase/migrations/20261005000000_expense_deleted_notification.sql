-- 지출을 삭제하면 같은 그룹에 알림이 가도록 한다. (추가형 — 앱 변경과 무관하게 적용해도 안전)
--
-- 그룹 멤버라면 남이 등록한 지출도 고치고 지울 수 있는 것은 협업 기능이라 그대로 두고(schema.md "알려진 제한"),
-- 대신 삭제는 흔적을 남긴다. 알림 문구는 지출 등록 알림(20261004000000)처럼 서버가 직접 만들어서, 삭제한 사람과
-- 지워진 내용을 클라이언트가 속일 수 없다.
--   "[그룹]에서 '항목' 내역(₩30,000, 결제: 하준)을 박서연님이 삭제했어요"

-- ============================================================
-- 1. 알림 종류에 expense_deleted 추가
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
  add constraint notifications_type_check check (type in ('expense', 'member_joined', 'expense_deleted'));

-- ============================================================
-- 2. 지출 삭제 알림 트리거
-- ============================================================

create or replace function public.notify_expense_deleted() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  gname text;
  deleter_id uuid;
  deleter text;
  payer text;
  item text;
begin
  -- 그룹이 통째로 지워지는 중이면(지출이 함께 삭제됨) 알림을 남길 그룹이 없다
  select name into gname from public.groups where id = old.group_id;
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

  -- 항목명은 사용자 입력이라 길면 줄인다 (app/src/domain/notifications.ts 의 expenseDeletedTitle 과 같아야 한다)
  item := case when char_length(old.title) > 30 then left(old.title, 30) || '…' else old.title end;

  insert into public.notifications (group_id, member_id, type, title)
  values (
    old.group_id,
    deleter_id,
    'expense_deleted',
    '[' || gname || ']에서 ''' || item || ''' 내역(₩' || to_char(old.amount, 'FM999,999,999,999,999')
      || ', 결제: ' || case when coalesce(payer, '') = '' then '알 수 없음' else payer end || ')을 '
      || case when deleter = '' then '누군가' else deleter end || '님이 삭제했어요'
  );
  return old;
end
$$;

revoke all on function public.notify_expense_deleted() from public, anon, authenticated;

drop trigger if exists expenses_notify_deleted on public.expenses;
create trigger expenses_notify_deleted
  after delete on public.expenses
  for each row execute function public.notify_expense_deleted();
