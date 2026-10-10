-- 회원가입 1단계에서 이메일 중복을 미리 확인 (추가만 하는 안전한 단계)
--
-- is_email_registered(이메일) : 이미 가입된(또는 가입 확인 메일만 받고 확인 전인) 이메일이면 true
--   * 가입 2단계(이름·계좌)를 입력하기 전에 "이미 가입된 이메일"을 알려주려고 만듦
--   * 로그인 전 화면에서 부르므로 anon(비로그인)에게도 실행 권한을 줌
--   * 트레이드오프: 누구나 특정 이메일의 가입 여부를 알 수 있음 (대부분의 서비스와 같은 수준으로 수용)
--   * 익명(게스트) 계정은 이메일이 없으므로 제외
-- 앱은 이 함수가 아직 없으면 중복 확인을 건너뛰고(이전 동작) 가입 제출 때 확인하므로, 앱 배포와 적용 순서는 상관없음

create or replace function public.is_email_registered(p_email text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.users
    where lower(email) = lower(btrim(coalesce(p_email, '')))
      and not coalesce(is_anonymous, false)
  )
$$;

revoke all on function public.is_email_registered(text) from public;
grant execute on function public.is_email_registered(text) to anon, authenticated;
