-- 게스트(로그인 없이 참여한 익명 세션)에겐 계좌번호를 주지 않는다.
-- 게스트 자리는 초대 링크만 있으면 들어올 수 있어서, 계좌번호는 정식 회원(user_id)으로 그룹에 속한 사람에게만 보인다.
-- 앱은 게스트에게 "로그인하면 계좌번호를 볼 수 있어요"를 보여준다. 앱 배포 전후 어느 쪽에 실행해도 안전하다.

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
