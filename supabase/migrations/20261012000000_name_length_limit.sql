-- 이름 길이를 20자로 제한한다. (추가만 하는 안전한 단계 — 새 앱 배포와 순서 무관)
--
-- 이름은 알림 문구("OO님이 …했어요", "OO님이 [그룹]에 참여를 요청했어요")에 그대로 들어간다. 길이 제한이 없으면 이름 칸에 긴
-- 문구를 넣어 다른 사람의 알림을 채울 수 있다(가짜 알림 문제와 같은 종류). 화면은 20자까지만 받고, 서버도 같은 한도를 건다.
--
-- NOT VALID: 이미 저장된 행은 검사하지 않고, 앞으로 넣거나 고치는 행만 검사한다.
--   * 이미 20자를 넘는 이름이 있다면 그 행을 고칠 때(다른 칸을 바꿀 때도) 이 제한에 걸리므로, 적용 전에 아래 조회로 확인한다.
--       select 'profiles' as t, id::text, name from public.profiles where char_length(btrim(name)) > 20
--       union all select 'members', id::text, name from public.members where char_length(btrim(name)) > 20
--       union all select 'join_requests', id::text, name from public.join_requests where char_length(btrim(name)) > 20;
--   * 기존 이름을 정리한 뒤 아래를 실행하면 기존 행까지 검증된다(선택).
--       alter table public.profiles validate constraint profiles_name_len;
--       alter table public.members validate constraint members_name_len;
--       alter table public.join_requests validate constraint join_requests_name_len;
-- 한도는 앱의 NAME_MAX_LENGTH(app/src/domain/name.ts)와 같아야 한다.

alter table public.profiles
  add constraint profiles_name_len check (char_length(btrim(name)) <= 20) not valid;

alter table public.members
  add constraint members_name_len check (name is null or char_length(btrim(name)) <= 20) not valid;

alter table public.join_requests
  add constraint join_requests_name_len check (char_length(btrim(name)) <= 20) not valid;
