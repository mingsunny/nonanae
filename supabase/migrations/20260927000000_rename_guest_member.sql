-- 게스트가 참여할 때 입력한 이름을 나중에 고칠 수 있게 하는 함수 (12 멤버 초대 화면, 자기 자신만).
--
-- members 테이블에는 UPDATE 정책 자체가 없다(가입/참여/탈퇴가 전부 이 파일 같은 보안 정의자 함수로만 이뤄짐).
-- "guest_uid = auth.uid()"만 검사하는 일반 UPDATE 정책을 열면, 같은 요청에 role/user_id 같은 다른 컬럼도
-- 함께 바꿔 자기 자신을 그룹장으로 만드는 등 권한 상승에 악용될 수 있어 함수로 name 컬럼만 딱 바꾼다.
--
-- 대상은 "지금 이 익명 세션이 차지하고 있는 멤버 자리"(guest_uid = auth.uid())뿐이라, 정식 회원 전환 전/후
-- 상태를 가리지 않고 항상 이 함수 하나로 충분하다. 정식 회원의 이름(프로필)은 이 함수와 무관하게
-- profiles_update_own 정책으로 이미 수정 가능하다.
--
-- 알림 문구는 생성 시점 이름으로 고정 저장되므로(schema.md), 개명 이전에 만들어진 알림 텍스트는 그대로 남는다.
-- 재입장(같은 이름을 다시 골라 그 자리로 인식)도 member.id로 매칭하므로 이름을 바꿔도 영향 없다.

create or replace function public.rename_guest_member(p_member_id uuid, p_name text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  new_name text := btrim(coalesce(p_name, ''));
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_anonymous_user() then raise exception 'only guests can rename via this function'; end if;
  if new_name = '' then raise exception 'name required'; end if;

  update public.members
     set name = new_name
   where id = p_member_id
     and guest_uid = auth.uid();

  if not found then raise exception 'rename target not available'; end if;
end
$$;

revoke all on function public.rename_guest_member(uuid, text) from public, anon;
grant execute on function public.rename_guest_member(uuid, text) to authenticated;
