-- 알림을 클라이언트가 직접 만들거나 고치지 못하게 닫는다. (파괴형 — 앱의 알림 직접 생성 코드가 빠진 버전을 배포한 뒤에 적용)
--
-- 알림은 이제 서버만 만든다: 지출 등록 → notify_expense_added 트리거(20261004000000),
-- 멤버 참여 → join_group(). 그래서 클라이언트에게 필요한 건 "읽음 표시"뿐이다.
-- 이걸 적용하면 이전 버전 앱은 지출 등록 알림을 직접 못 넣는다(그 앱은 실패를 로그만 남기고 넘어가므로 지출 등록은 정상).

drop policy if exists notifications_insert on public.notifications;

revoke insert on public.notifications from authenticated;

-- 수정은 read(읽음 표시) 컬럼만. title/type/member_id 를 바꿔 문구를 위조하지 못하게 한다.
revoke update on public.notifications from authenticated;
grant update (read) on public.notifications to authenticated;
