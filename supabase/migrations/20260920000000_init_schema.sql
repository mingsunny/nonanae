-- 노나내 초기 스키마 — docs/spec/schema.md 기준
--
-- 스펙과 다르게 잡은 부분 (의도된 매핑):
--   * User(email, passwordHash, emailVerified) -> Supabase Auth(auth.users)가 담당. 스펙의 User는 public.profiles
--     (name, bank, account, seen_group_create_coach)로 두고 auth.users.id를 그대로 PK로 씀
--   * id는 전부 uuid (프로토타입의 uid('g') 같은 문자열 대신)
--   * 게스트는 User가 아니라 members(user_id null + name)로만 존재 — 스펙 그대로
--
-- 실행 방법: Supabase 대시보드 > SQL Editor에 통째로 붙여넣고 Run (또는 supabase db push)

-- ============================================================
-- 1. 테이블
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  bank text not null check (length(btrim(bank)) > 0),
  account text not null check (length(btrim(account)) > 0),
  seen_group_create_coach boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.gen_invite_code() returns text
language sql volatile set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 6)
$$;

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  invite_code text not null unique default public.gen_invite_code(),
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  -- 정식 회원만 채워짐. 게스트/placeholder는 null (탈퇴 시에도 null로 바뀜)
  user_id uuid references public.profiles (id) on delete set null,
  role text not null default 'member' check (role in ('owner', 'member')),
  -- user_id가 null일 때의 표시 이름
  name text check (name is null or length(btrim(name)) > 0),
  joined_at timestamptz not null default now(),
  constraint members_has_identity check (user_id is not null or name is not null),
  -- expenses / expense_participants가 "같은 그룹의 멤버만" 가리키도록 복합 FK에 쓰는 키
  unique (id, group_id)
);
create unique index members_group_user_uniq on public.members (group_id, user_id) where user_id is not null;
create unique index members_one_owner_per_group on public.members (group_id) where role = 'owner';
create index members_user_idx on public.members (user_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  paid_by uuid not null,
  title text not null check (length(btrim(title)) > 0),
  amount bigint not null check (amount > 0),
  category text not null check (category in ('lodging', 'food', 'transport', 'activity', 'shopping', 'etc')),
  receipt_image_url text,
  split_type text not null default 'equal' check (split_type in ('equal', 'ratio', 'amount')),
  spent_at date not null default current_date,
  created_at timestamptz not null default now(),
  unique (id, group_id),
  foreign key (paid_by, group_id) references public.members (id, group_id)
);
create index expenses_group_spent_idx on public.expenses (group_id, spent_at desc, created_at desc);

-- share_amount: split_type이 equal이면 null(매번 계산), ratio/amount면 등록 시점에 원 단위 정수로 확정.
-- (다른 테이블 값에 의존하는 규칙이라 CHECK로는 못 걸고, 앱/함수에서 지킴)
create table public.expense_participants (
  expense_id uuid not null,
  member_id uuid not null,
  -- 소속 그룹. 지출과 멤버가 같은 그룹인지 복합 FK로 보장하려고 비정규화해서 둠
  group_id uuid not null,
  share_amount bigint check (share_amount is null or share_amount >= 0),
  primary key (expense_id, member_id),
  foreign key (expense_id, group_id) references public.expenses (id, group_id) on delete cascade,
  foreign key (member_id, group_id) references public.members (id, group_id)
);
create index expense_participants_member_idx on public.expense_participants (member_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  member_id uuid references public.members (id) on delete set null,
  type text not null check (type in ('expense', 'member_joined')),
  -- 생성 시점에 이름을 채워 고정 저장 (이후 이름이 바뀌어도 문구는 그대로)
  title text not null,
  -- 스펙 그대로 알림 1건당 읽음 플래그 1개. 그룹원이 여러 명이면 "누가 읽었는지"는 구분 못 함 (아래 참고)
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_group_created_idx on public.notifications (group_id, created_at desc);

-- ============================================================
-- 2. 가입 / 탈퇴 트리거
-- ============================================================

-- 회원가입 시 supabase.auth.signUp({ email, password, options: { data: { name, bank, account } } })로
-- 넘긴 값을 profiles로 복사. 셋 중 하나라도 없으면 NOT NULL 위반으로 가입이 실패함 (스펙: 가입 시 계좌 필수)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
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

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 회원 탈퇴 시 그 사람의 멤버 행이 "이름 없는 빈 멤버"가 되지 않도록, 지우기 직전에 이름을 members.name에 옮겨둠.
-- (FK가 user_id를 null로 바꾸므로 이름만 남는 placeholder와 같은 모양이 됨. 지출/정산 기록은 그대로 유지)
create or replace function public.preserve_member_name() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.members set name = old.name where user_id = old.id;
  return old;
end
$$;

create trigger before_profile_delete
before delete on public.profiles
for each row execute function public.preserve_member_name();

-- ============================================================
-- 3. 권한 헬퍼 (RLS에서 사용)
-- ============================================================

create or replace function public.is_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.members where group_id = gid and user_id = auth.uid())
$$;

create or replace function public.is_group_owner(gid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.members where group_id = gid and user_id = auth.uid() and role = 'owner')
$$;

create or replace function public.shares_group_with(uid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.members a
    join public.members b on b.group_id = a.group_id
    where a.user_id = auth.uid() and b.user_id = uid
  )
$$;

-- ============================================================
-- 4. RLS — 테이블은 로그인한 그룹 멤버만 읽고 쓸 수 있음
--    (anon 키는 브라우저에 노출되므로 RLS 없이는 누구나 전부 읽고 쓸 수 있게 됨)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_participants enable row level security;
alter table public.notifications enable row level security;

-- 내 프로필 + 같은 그룹 멤버의 프로필(정산 화면에서 은행/계좌를 보여줘야 해서)
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_group_with(id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- 그룹 생성은 아래 create_group()으로만 함 (그룹+그룹장 멤버를 한 번에 만들어야 하므로 insert 정책 없음)
create policy groups_select on public.groups for select to authenticated
  using (public.is_group_member(id));
create policy groups_update_owner on public.groups for update to authenticated
  using (public.is_group_owner(id)) with check (public.is_group_owner(id));
create policy groups_delete_owner on public.groups for delete to authenticated
  using (public.is_group_owner(id));

create policy members_select on public.members for select to authenticated
  using (public.is_group_member(group_id));
-- 멤버 누구나 "앱 미가입 친구"(이름만 있는 placeholder)를 추가할 수 있음. 참여/그룹장 지정은 join_group()/create_group()만 가능
create policy members_insert_placeholder on public.members for insert to authenticated
  with check (public.is_group_member(group_id) and user_id is null and role = 'member' and name is not null);

create policy expenses_all on public.expenses for all to authenticated
  using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));
create policy expense_participants_all on public.expense_participants for all to authenticated
  using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));

create policy notifications_select on public.notifications for select to authenticated
  using (public.is_group_member(group_id));
create policy notifications_insert on public.notifications for insert to authenticated
  with check (public.is_group_member(group_id));
create policy notifications_update on public.notifications for update to authenticated
  using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));

-- ============================================================
-- 5. RPC — RLS만으로는 표현하기 어려운 흐름
-- ============================================================

-- 05 새 그룹 만들기: 그룹 + 그룹장 멤버를 한 번에 만들고 group id를 돌려줌
create or replace function public.create_group(p_name text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  gid uuid;
  tries int := 0;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then raise exception 'group name required'; end if;

  loop
    begin
      insert into public.groups (name) values (btrim(p_name)) returning id into gid;
      exit;
    exception when unique_violation then
      -- 초대코드가 우연히 겹친 경우만 재시도
      tries := tries + 1;
      if tries >= 5 then raise; end if;
    end;
  end loop;

  insert into public.members (group_id, user_id, role) values (gid, auth.uid(), 'owner');
  return gid;
end
$$;

-- 06 초대코드로 참여 (1): 코드 확인 + 07 "나 고르기" 화면에 보여줄 멤버 목록
-- p_code는 공용 코드(6자리)만. "코드-멤버ID" 형태의 개인화 코드는 앱에서 잘라서 넘기고, 멤버ID는 join_group()에 전달
create or replace function public.lookup_group_by_code(p_code text) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  g public.groups;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into g from public.groups where invite_code = upper(btrim(p_code));
  if not found then return null; end if;

  return jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'name', coalesce(m.name, p.name),
        'claimed', m.user_id is not null
      ) order by m.joined_at)
      from public.members m
      left join public.profiles p on p.id = m.user_id
      where m.group_id = g.id
    ), '[]'::jsonb)
  );
end
$$;

-- 06/07 초대코드로 참여 (2): p_member_id가 있으면 그 placeholder 자리를 내 계정으로 채우고, 없으면 새 멤버로 추가.
-- 이미 이 그룹 멤버면 기존 멤버 id를 그대로 돌려줌(재입장). 참여 알림도 함께 생성
create or replace function public.join_group(p_code text, p_member_id uuid default null) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  g public.groups;
  mid uuid;
  pname text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into g from public.groups where invite_code = upper(btrim(p_code));
  if not found then raise exception 'invalid invite code'; end if;

  select id into mid from public.members where group_id = g.id and user_id = auth.uid();
  if found then return mid; end if;

  if p_member_id is not null then
    update public.members
       set user_id = auth.uid(), name = null, joined_at = now()
     where id = p_member_id and group_id = g.id and user_id is null
    returning id into mid;
    if not found then raise exception 'member not available'; end if;
  else
    insert into public.members (group_id, user_id) values (g.id, auth.uid()) returning id into mid;
  end if;

  select name into pname from public.profiles where id = auth.uid();
  insert into public.notifications (group_id, member_id, type, title)
  values (g.id, mid, 'member_joined', pname || '님이 [' || g.name || '] 그룹에 참여했어요');

  return mid;
end
$$;

-- ============================================================
-- 6. 실행 권한 — 로그인한 사용자만
-- ============================================================

revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from public, anon;

grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_owner(uuid) to authenticated;
grant execute on function public.shares_group_with(uuid) to authenticated;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.lookup_group_by_code(text) to authenticated;
grant execute on function public.join_group(text, uuid) to authenticated;
