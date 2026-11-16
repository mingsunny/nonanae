# Supabase에서 할 일 (백엔드 체크리스트)

앱(Vercel)은 `main`에 머지되면 자동 배포되지만, **Supabase(DB·인증 설정)는 손으로 적용**해야 한다.
아래는 저장소에는 있지만 서버에 적용됐는지 확인되지 않은 것들이다. 마지막 정리: 2026-11-16.

## 1. 지금 무엇이 적용돼 있는지 먼저 확인 (읽기만 함, 안전)

SQL Editor에 붙여 넣고 실행 → `applied`가 `false`인 줄만 아래 2번에서 실행하면 된다.

```sql
select step, applied from (values
  (1,  '20261010000000_email_registered_check',      exists (select 1 from pg_proc where proname = 'is_email_registered')),
  (2,  '20261011000000_profile_after_confirmation',  exists (select 1 from pg_proc where proname = 'complete_profile')),
  (3,  '20261011000100_join_approval',               exists (select 1 from pg_proc where proname = 'approve_join_request')),
  (4,  '20261011000200_lock_direct_join',            not has_function_privilege('authenticated', 'public.join_group(text, uuid, text)', 'execute')),
  (5,  '20261012000000_name_length_limit',           exists (select 1 from pg_constraint where conname = 'members_name_len')),
  (6,  '20261017000000_join_request_status',         exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'join_requests' and column_name = 'status')),
  (7,  '20261025000000_safe_join_policy',            exists (select 1 from pg_proc where proname = 'hand_over_owner')),
  (8,  '20261026000000_user_consents',               exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'user_consents')),
  (9,  '20261027000000_delete_audit_log_on_withdraw', exists (select 1 from pg_proc where proname = 'delete_auth_audit_logs')),
  (10, '20261116100000_group_currency',              exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'groups' and column_name = 'currency'))
) as t(n, step, applied) order by n;
```

## 2. SQL 실행 (위에서 false인 것만, 이 순서대로)

파일은 모두 `supabase/migrations/`에 있다. 파일 내용을 통째로 SQL Editor에 붙여 넣고 실행.

| 순서 | 파일 | 하는 일 | 안 하면 |
|---|---|---|---|
| 1 | `20261010000000_email_registered_check.sql` | 가입 1단계에서 이메일 중복을 미리 알려 줌 | 중복 확인이 조용히 건너뛰어짐(가입 제출 때 걸러지긴 함) |
| 2 | `20261011000000_profile_after_confirmation.sql` | 이메일 확인 뒤 이름·계좌 등록 | 가입 2단계가 실패할 수 있음 |
| 3 | `20261011000100_join_approval.sql` | 참여 요청·그룹장 승인 | 승인 기능이 동작 안 함 |
| 4 | `20261011000200_lock_direct_join.sql` | 승인 없이 바로 들어오는 옛 경로 차단 (**3번 다음에만**) | 초대코드만 알면 API로 승인을 건너뛸 수 있음 |
| 5 | `20261012000000_name_length_limit.sql` | 이름 20자 제한 | 긴 이름으로 알림 문구 도배 가능 |
| 6 | `20261017000000_join_request_status.sql` | 거절된 요청을 "거절됨"으로 남김 | 거절당한 사람이 처음 온 사람처럼 보임 |
| 7 | `20261025000000_safe_join_policy.sql` | 참여 정책 정리, 탈퇴 시 그룹장 넘기기 (**6번 다음에**) | 개인정보 처리방침의 "게스트는 계좌번호를 못 봄"이 사실이 아님 |
| 8 | `20261026000000_user_consents.sql` | 약관·처리방침 동의 기록 | 동의 기록이 안 남음 |
| 9 | `20261027000000_delete_audit_log_on_withdraw.sql` | 탈퇴 시 인증 로그의 이메일도 삭제 (**7번 다음에**) | 탈퇴해도 인증 로그에 이메일이 남음 |
| 10 | `20261116100000_group_currency.sql` | **그룹 통화 KRW/USD (PR #72)** | 모든 그룹이 KRW로만 보이고, 통화를 바꾸려 하면 "서버 업데이트 뒤에 쓸 수 있어요" 안내 |

다 실행한 뒤 1번 확인 SQL을 다시 돌려서 전부 `true`인지 본다.

## 3. 대시보드 설정 (SQL 아님)

- **Authentication → Providers → Email → Password requirements**: 최소 8자, 영문+숫자. (앱은 이미 같은 규칙으로 막고 있음)
- **Authentication → Email Templates**: 가입 확인·비밀번호 재설정 메일을 한국어로.
- **Authentication → SMTP**: 노나내 Gmail(`nonanae.info@gmail.com`)을 발신 메일로 연결 (Gmail 앱 비밀번호 사용). 기본 메일 발송은 시간당 몇 통으로 제한된다.

## 4. 그룹 통화(PR #72) 적용 뒤 확인할 것

실제 화면은 아직 아무도 확인하지 않았다. SQL 10번을 실행한 뒤 휴대폰으로:

1. 새 그룹 → 지출 화면 헤더의 "이 여행에서 총 사용한 금액" 줄 오른쪽 `KRW ▾` → `USD`로 바꾸면 "통화를 USD로 바꿨어요"
2. 지출 추가에서 `12.34` 입력 → 균등 분담·합계가 `$`로, 등록 뒤 목록·총액이 `$12.34`
3. 정산·요약 탭, 그룹 목록의 총액도 `$`
4. 그 지출을 삭제 → 알림 종의 삭제 알림 문구가 `$12.34`
5. 지출이 있는 그룹에서 통화를 바꾸려 하면 "지출이 있는 그룹은 통화를 바꿀 수 없어요"가 뜨고 그대로
6. 기존 그룹(SQL 전 데이터)은 모두 KRW 그대로

## 5. 토스 미니앱 (아직 main에 없음)

토스 로그인용 SQL·Edge Function·콘솔 설정은 브랜치 `feat/toss-miniapp`(PR #71)의 `docs/toss-miniapp.md`에 따로 있다.
이 브랜치를 머지하기 전에는 실행하지 않는다.
https://github.com/mingsunny/nonanae/blob/feat/toss-miniapp/docs/toss-miniapp.md
