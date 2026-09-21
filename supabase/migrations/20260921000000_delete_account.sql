-- 회원 탈퇴 (04-profile). 브라우저에서 쓰는 키로는 auth.users를 지울 수 없어서, "본인 계정만" 지우는 DB 함수를 둔다.
--
-- 흐름: auth.users 삭제 → profiles 삭제(cascade) → before_profile_delete 트리거가 이름을 members.name에 남김
--       → members.user_id는 null이 됨. 그룹·멤버·지출·알림 기록은 그대로 남고, 그 사람은 "이름 있는 미가입 멤버"가 된다.
-- 게스트(익명 세션)는 대상이 아니다. 게스트가 나가는 흐름은 로그아웃으로 처리한다.
--
-- 실행 순서: 기존 두 마이그레이션(init_schema, guest_support) 다음. 여러 번 실행해도 안전(create or replace).

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if public.is_anonymous_user() then raise exception 'guests cannot delete accounts'; end if;

  delete from auth.users where id = auth.uid();
end
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
