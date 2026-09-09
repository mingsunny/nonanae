# 08~11 데이터 스키마 정리 (2026-09-09)

- **범위**: `PLAN-sep03-yunjung.md` 전체를 대체하는 문서가 아니라, 08(지출 목록)·09(정산)·10(요약)·11(지출 폼) 네 화면이 실제로 쓰는 데이터만 다시 정리한 문서. 로그인/온보딩/초대 등 다른 화면 스키마는 `PLAN-sep03-yunjung.md`가 계속 원본.
- **기준**: `settlement-prototype-sep06-yunjung.html`(사용 날짜 입력 필드 포함 버전)의 실제 동작 + 08~11 스펙 문서 작업 중 확정된 결정사항

## 기존 PLAN-sep03 대비 변경 요약

| 항목 | PLAN-sep03 | 이 문서(sep09) | 이유 |
|---|---|---|---|
| 지출 항목명 | 없음(`memo`만 있음, 선택) | `title` 필수 필드로 교체 | 프로토타입은 항목명을 필수 입력으로 받음. "메모"라는 별도 선택 필드는 실제로 안 씀 |
| 균등 분배 나머지 배분 | 결제자는 나머지 배분에서 제외(손해 안 봄) | 결제자 예외 없음 — 참여자 전원을 동일한 규칙으로 배분 | 11 작업 중 단순화 결정(1원 차이는 무의미, 예외 규칙 없어도 됨) |
| 계좌 | `bank_accounts`에 `is_primary`로 다중 계좌 등록 상정 | 유저당 계좌 정확히 1개(다중 계좌 개념 없음) | 온보딩/프로필 어디에도 "계좌 추가" UI가 없음 — 실제로 항상 1개뿐 |
| 그룹 멤버 | `group_members.user_id`가 항상 존재한다고 가정 | `user_id`는 NULLABLE — 대기 중(앱 미가입) 멤버는 이름만 있고 user_id 없음 | 12(멤버 초대)의 "이름만으로 미리 추가" 기능이 PLAN 스키마에 반영 안 되어 있었음 |
| 게스트 가입 | 없음(카카오 로그인만 v1) | 개념만 표시, 스키마 미정 | 새로 나온 개념. 로그인 플로우 전체를 다루는 별도 스펙에서 확정 예정 — 이 문서에서는 "계좌 없음" 케이스에 게스트도 해당된다는 정도만 표시 |

## 테이블

### users
```
users (id, kakao_id NULLABLE, name, created_at)
```
- `kakao_id`가 NULLABLE인 이유: 게스트 가입(카카오 로그인 없이 가입) 시 값이 없을 수 있음 — 단, 게스트 가입 자체의 나머지 스펙(인증 방식, 식별자 등)은 미정
- `name`: 최초엔 카카오 닉네임, 이후 사용자가 직접 수정 가능(PLAN-sep03 §도메인모델 참고)

### bank_accounts
```
bank_accounts (id, user_id FK, bank_name, account_number, account_holder, created_at)
```
- 유저당 정확히 0개 또는 1개만 존재(다중 계좌 등록 기능 없음 — `is_primary` 컬럼 삭제)
- 0개인 경우: 대기 중 멤버(아직 `users` 행 자체가 없음), 계좌 등록 전 상태의 게스트 등

### groups
```
groups (id, name, invite_code UNIQUE, created_by FK, created_at)
```
- PLAN-sep03과 동일(변경 없음)

### group_members
```
group_members (group_id FK, user_id FK NULLABLE, pending_name NULLABLE, role, joined_at, PRIMARY KEY(group_id, 임시 id))
```
- `user_id`가 NULL이면 대기 중(앱 미가입) 멤버 — 이 경우 `pending_name`에 12에서 입력한 이름이 들어감
- 대기 중 멤버가 실제로 앱에 가입해 매칭되면(07) `user_id`를 채우고 `pending_name`은 더 이상 안 씀
- ⚠️ PLAN-sep03의 원래 정의는 `PRIMARY KEY(group_id, user_id)`였는데, `user_id`가 NULL일 수 있게 되면서 복합키가 깨짐 — 실제 구현 시 별도 `id` 컬럼 필요(위에 "임시 id"로 표시)

### expenses
```
expenses (id, group_id FK, paid_by FK, title, amount, category, receipt_image_url NULLABLE, split_type, spent_at, created_at)
```
- `paid_by`: 결제자(users FK)
- `title`: 항목명, 필수(예: "흑돼지 저녁식사") — PLAN-sep03의 `memo`(선택 메모)를 대체
- `category`: 6종 enum — 숙소 / 식비 / 교통 / 액티비티 / 쇼핑 / 기타
- `split_type`: equal | ratio | amount
- `spent_at`: 사용 날짜(사용자가 폼에서 직접 선택, 기본값 오늘) — `created_at`(등록 시각)과 별개

### expense_participants
```
expense_participants (expense_id FK, user_id FK, share_amount NULLABLE, PRIMARY KEY(expense_id, user_id))
```
- 지출 1건의 참여자 목록 + 분담액
- `share_amount`: `split_type='equal'`이면 NULL(매번 계산), `ratio`/`amount`면 등록 시점에 정수(원 단위)로 확정해서 저장

## 잔액/정산 계산 로직 (업데이트)

1. **잔액 계산**: 멤버별 `balance = 결제 합(paid_by 기준 amount 합) - 부담 합(참여자로 지정된 지출들의 share 합)`
2. **분담액(share) 계산**
   - `equal`: `base = floor(amount / N)`, 나머지는 **참여자 전체를 user_id 오름차순으로 정렬해 앞에서부터 1원씩 추가**(결제자 예외 없음 — PLAN-sep03과의 차이)
   - `ratio`: 입력한 %를 원 단위로 환산(내림) 후, 남는 오차를 참여자 user_id 오름차순으로 1원씩 분배
   - `amount`: 입력값을 그대로 반올림해서 저장
3. **최소 송금 매칭**: 채권자(balance>0)·채무자(balance<0)를 각각 금액 내림차순 정렬 후 가장 큰 채권자·채무자부터 그리디 매칭 — 진짜 최소 거래 수를 보장하진 않지만 여행 그룹 규모(2~15명)에서는 실무적으로 충분함(PLAN-sep03 §정산 알고리즘과 동일, 결제자 예외만 제거됨)
4. **카테고리별 집계**: `expenses.category`로 그룹핑해서 합산

## 화면별 데이터 사용 매핑

| 화면 | 읽는 데이터 | 쓰는 데이터 |
|---|---|---|
| 08 지출 목록 | `expenses`, `expense_participants`(참여자 수만), `group_members`(이름) | 없음(조회 전용) |
| 09 정산 | 위 잔액 계산 결과, `users`(이름), `bank_accounts`(계좌) | 없음(조회 전용, 클립보드 복사만) |
| 10 요약 | 위 잔액 계산 결과, `expenses.category` 집계, `users` | 없음(조회 전용) |
| 11 지출 폼 | `group_members`(결제자/참여자 선택지) | `expenses` 신규 행 또는 수정, `expense_participants` 신규/수정/삭제 |

## 아직 안 정한 것

- 게스트 가입의 실제 인증/식별 방식(로그인 플로우 스펙에서 별도 확정 예정)
- `group_members`의 복합키 문제(위 ⚠️ 참고) — 실제 구현 시 별도 PK 컬럼 추가 필요
