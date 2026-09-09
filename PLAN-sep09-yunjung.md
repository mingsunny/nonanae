# 08~11 데이터 스키마 정리 (2026-09-09)

- **기준**: `settlement-prototype-sep06-yunjung.html`

## 테이블

### users
```
users (id, kakao_id NULLABLE, name, created_at)
```
- `id` 카카오 로그인과 무관하게 유저에 자동으로 생기는 내부 식별자
   - 게스트인 경우에도 발급
- `kakao_id`가 NULLABLE인 이유: 게스트 가입(카카오 로그인 없이 가입) 시 값이 없을 수 있음
   - 게스트인 경우 (NULL) 별도의 인증과 식별 기능 없음.
- `name`: 최초엔 카카오 닉네임, 이후 사용자가 직접 수정 가능

### bank_accounts
```
bank_accounts (id, user_id FK, bank_name, account_number, created_at)
```
- `id` 은행계좌 등록시 자동으로 생기는 내부 식별자
- `user_id FK`
- `bank name` 은행계좌 등록시 유저가 선택한 은행 명
- `account number` 은행계좌 등록시 유저가 입력한 계좌번호
   - 유저당 0개 또는 1개만 존재
- `created_at` 은행계좌 등록 일시 (YYYY-MM-DD HH:MM:SS)

### groups
```
groups (id, name, invite_code UNIQUE, created_by FK, created_at)
```
- `id`: 그룹 생성 시 자동으로 생기는 내부 식별자
- `name`: 그룹(여행) 이름
- `invite_code`: 초대코드, 그룹마다 고유(UNIQUE)
- `created_by FK`: 그룹을 만든 사람
- `created_at`: 그룹 생성 일시

### group_members
```
group_members (id, group_id FK, user_id FK NULLABLE, pending_name NULLABLE, role, joined_at)
```
- `id`: 그룹멤버 행 자체의 내부 식별자
   - 기존엔 `PRIMARY KEY(group_id, user_id)`였는데, `user_id`가 NULL일 수 있게 되면서 복합키가 깨져서 별도 `id` 필요
- `group_id FK`
- `user_id FK` — NULLABLE. 대기 중(앱 미가입) 멤버는 NULL
- `pending_name` — `user_id`가 NULL일 때만 사용. 12에서 이름만으로 추가된 멤버의 이름
   - 대기 중 멤버가 나중에 앱에 가입해 매칭되면(07) `user_id`를 채우고 `pending_name`은 더 이상 안 씀
- `role`: owner | member
- `joined_at`: 그룹에 들어온 일시

### expenses
```
expenses (id, group_id FK, paid_by FK, title, amount, category, receipt_image_url NULLABLE, split_type, spent_at, created_at)
```
- `id`: 지출 등록 시 자동으로 생기는 내부 식별자
- `group_id FK`
- `paid_by FK`: 결제자
- `title`: 항목명, 필수 입력(예: "흑돼지 저녁식사")
- `amount`: 지출 금액
- `category`: 카테고리 6종 — 숙소 / 식비 / 교통 / 액티비티 / 쇼핑 / 기타
- `receipt_image_url` — NULLABLE. 영수증 사진, 선택 입력
- `split_type`: 나누기 방식 — equal | ratio | amount
- `spent_at`: 사용 날짜. 유저가 폼에서 직접 선택, 기본값 오늘
- `created_at`: 지출 등록 일시

### expense_participants
```
expense_participants (expense_id FK, user_id FK, share_amount NULLABLE)
```
- `expense_id FK`
- `user_id FK`
   - 위 둘을 합쳐 PRIMARY KEY(한 지출에 같은 사람이 두 번 참여자로 안 들어감)
- `share_amount` — NULLABLE. `split_type`이 equal이면 NULL(매번 계산), ratio/amount면 등록 시점에 정수(원 단위)로 확정해서 저장

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
