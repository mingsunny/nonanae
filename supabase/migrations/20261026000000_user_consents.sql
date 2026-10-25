-- 이용약관·개인정보 처리방침 동의 기록 (추가만 하는 안전한 단계 — 앱 배포와 적용 순서는 상관없음)
--
-- 누가 어느 버전에 언제 동의했는지 남긴다. 동의 시각은 서버 시각(now())이다.
--   * 회원: 가입 화면에서 동의한 내용을 가입 요청(user_metadata.consent)에 실어 보내고, 가입 트리거가 기록한다.
--     가입 확인 메일을 누르기 전에는 세션이 없어서 앱이 직접 기록할 수 없기 때문이다.
--   * 게스트: 이름을 입력하고 참여할 때 앱이 record_consents()를 부른다.
-- 앱이 먼저 배포돼도 가입 요청의 user_metadata.consent는 남아 있으므로, 맨 아래에서 가입 시각 기준으로 한 번 옮겨 담는다.
-- 반대로 이 SQL이 먼저 적용돼도 예전 앱은 consent를 보내지 않을 뿐이라 아무 영향이 없다.
-- 탈퇴(auth.users 삭제)하면 동의 기록도 함께 지워진다.

create table public.user_consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- terms: 이용약관, privacy: 개인정보 처리방침, age14: 만 14세 이상 확인
  kind text not null check (kind in ('terms', 'privacy', 'age14')),
  -- 동의한 문서의 시행일 (예: 2026-10-24). age14는 확인한 날의 약관 버전
  version text not null check (length(version) between 1 and 20),
  agreed_at timestamptz not null default now(),
  constraint user_consents_once unique (user_id, kind, version)
);

alter table public.user_consents enable row level security;
revoke all on public.user_consents from anon, authenticated;
-- 본인 기록만 읽을 수 있다. 쓰기는 아래 함수로만 한다.
grant select on public.user_consents to authenticated;
create policy user_consents_select_own on public.user_consents
  for select to authenticated using (user_id = auth.uid());

-- ============================================================
-- 1. 가입 요청에 실린 동의를 기록 (트리거와 맨 아래 옮겨 담기에서 같이 쓴다)
-- ============================================================

create or replace function public.save_signup_consents(p_user_id uuid, p_consent jsonb, p_at timestamptz)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  terms text := nullif(btrim(coalesce(p_consent ->> 'terms', '')), '');
  privacy text := nullif(btrim(coalesce(p_consent ->> 'privacy', '')), '');
begin
  -- 약관과 처리방침 둘 다 있어야 동의한 가입으로 본다 (예전 앱은 consent를 보내지 않는다)
  if terms is null or privacy is null or length(terms) > 20 or length(privacy) > 20 then
    return;
  end if;

  insert into public.user_consents (user_id, kind, version, agreed_at)
  values (p_user_id, 'terms', terms, p_at), (p_user_id, 'privacy', privacy, p_at)
  on conflict on constraint user_consents_once do nothing;

  if p_consent ->> 'age14' = 'true' then
    insert into public.user_consents (user_id, kind, version, agreed_at)
    values (p_user_id, 'age14', terms, p_at)
    on conflict on constraint user_consents_once do nothing;
  end if;
end
$$;

revoke all on function public.save_signup_consents(uuid, jsonb, timestamptz) from public, anon, authenticated;

-- ============================================================
-- 2. 가입 트리거 (handle_new_user와 별도로 둔다 — 그 함수는 건드리지 않는다)
-- ============================================================

create or replace function public.record_signup_consents() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not coalesce(new.is_anonymous, false) and new.raw_user_meta_data ? 'consent' then
    perform public.save_signup_consents(new.id, new.raw_user_meta_data -> 'consent', now());
  end if;
  return new;
end
$$;

revoke all on function public.record_signup_consents() from public, anon, authenticated;

create trigger on_auth_user_created_consents
  after insert on auth.users
  for each row execute function public.record_signup_consents();

-- ============================================================
-- 3. 로그인한 사람(게스트 포함)이 지금 보고 있는 약관·처리방침에 동의했다고 기록
-- ============================================================

create or replace function public.record_consents(p_terms text, p_privacy text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  terms text := btrim(coalesce(p_terms, ''));
  privacy text := btrim(coalesce(p_privacy, ''));
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if terms = '' or privacy = '' or length(terms) > 20 or length(privacy) > 20 then
    raise exception 'invalid consent version';
  end if;

  insert into public.user_consents (user_id, kind, version)
  values (auth.uid(), 'terms', terms), (auth.uid(), 'privacy', privacy)
  on conflict on constraint user_consents_once do nothing;
end
$$;

revoke all on function public.record_consents(text, text) from public, anon;
grant execute on function public.record_consents(text, text) to authenticated;

-- ============================================================
-- 4. 이 SQL보다 앱이 먼저 배포됐을 때 생긴 가입을 옮겨 담기 (동의 시각 = 가입 시각)
-- ============================================================

select public.save_signup_consents(u.id, u.raw_user_meta_data -> 'consent', u.created_at)
from auth.users u
where not coalesce(u.is_anonymous, false)
  and u.raw_user_meta_data ? 'consent';
