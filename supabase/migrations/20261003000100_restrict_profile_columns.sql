-- 보안 강화 2/2 (되돌리기 어려운 단계 — 1/2를 적용하고 앱이 새 버전으로 배포된 뒤에만 적용한다)
--
-- profiles의 은행·계좌번호 컬럼을 API로 직접 읽을 수 없게 막는다. 같은 그룹 멤버(게스트 포함)가
-- 공개 키만으로 다른 회원의 계좌번호 전체를 읽던 문제를 닫는다.
--   - 이름 등 나머지 컬럼은 이전처럼 같은 그룹 멤버끼리 읽을 수 있다 (멤버 표시에 필요)
--   - 내 계좌: get_my_profile() / 받을 사람 계좌: get_payee_accounts() 로만 읽는다 (1/2 파일)
--   - 수정(UPDATE)은 그대로다. 본인 행만 고칠 수 있는 정책(profiles_update_own)이 이미 있다
--
-- 되돌리려면: grant select on public.profiles to authenticated;

-- 먼저 한 번 더 정리: 1/2 적용 이후에 가입한 계정의 로그인 정보에 남아 있는 계좌번호 사본을 지운다.
-- (1/2의 가입 트리거가 지워도 로그인 서버가 가입 직후 되돌려서, 앱이 가입 뒤에 직접 지우도록 고치기 전 가입자에게 남아 있다. 여러 번 실행해도 안전)
update auth.users
   set raw_user_meta_data = raw_user_meta_data - 'bank' - 'account'
 where raw_user_meta_data ?| array['bank', 'account'];

revoke select on public.profiles from authenticated;
grant select (id, name, seen_group_create_coach, created_at) on public.profiles to authenticated;
