-- 초대코드 참여에 방장 승인 추가 2/2 (되돌리기 어려운 단계 — 1/2를 적용하고 앱이 새 버전으로 배포된 뒤에만 적용)
--
-- 승인 없이 바로 멤버가 되던 join_group()을 클라이언트가 더 이상 부르지 못하게 막는다.
-- 이걸 적용하기 전까지는 초대코드를 아는 사람이 API로 join_group()을 직접 불러 승인을 건너뛸 수 있다.
-- 이전 버전 앱은 이걸 적용하면 참여가 안 된다(새 버전 앱은 request_join()만 쓴다).
--
-- 되돌리려면: grant execute on function public.join_group(text, uuid, text) to authenticated;

revoke all on function public.join_group(text, uuid, text) from public, anon, authenticated;
