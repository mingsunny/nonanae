# 08~11 데이터 스키마 정리 (2026-09-09)

- **기준**: `settlement-prototype-sep06-yunjung.html`

## 테이블

### users
```
users (id, kakao_id NULLABLE, name, created_at)
```
- `id` 카카오 로그인과 무관하게 유저에 자동으로 생기는 내부 식별자
   - 게스트 로그인하는 경우에도 생성
   - 대기 중인 상태에서는 (카카오 / 게스트 로그인 전) 미 생성
- `kakao_id` 카카오에서 받아오는 식별자
   - 게스트(카카오 로그인 없이 이용)인 경우 NULL. 별도의 인증과 식별 기능 없음.
- `name` 최초엔 카카오 닉네임, 이후 사용자가 직접 수정 가능
   - 게스트의 경우 스스로 입력

### bank_accounts
```
bank_accounts (id, user_id FK, bank_name, account_number, created_at)
```
- `id` 은행계좌 등록시 자동으로 생기는 내부 식별자
- `user_id FK` 계좌 주인의 `user_id`
- `bank name` 은행계좌 등록시 유저가 선택한 은행 명
   - 은행(18종): 카카오뱅크, 토스뱅크, 케이뱅크, 국민은행, 신한은행, 우리은행, 하나은행, 농협은행, 기업은행, SC제일은행, 씨
티은행, 우체국, 새마을금고, 신협, 부산은행, 대구은행, 광주은행, 경남은행
- `account number` 은행계좌 등록시 유저가 입력한 계좌번호
   - 유저당 0개 또는 1개만 존재
- `created_at` 은행계좌 등록 일시

### groups
```
groups (id, name, invite_code UNIQUE, created_by FK, created_at)
```
- `id` 그룹 생성 시 자동으로 생기는 내부 식별자
- `name` 유저가 입력한 그룹(여행) 이름
- `invite_code` 그룹 생성 시 자동으로 생기는 초대코드, 그룹마다 고유(UNIQUE)
- `created_by FK` 그룹을 만든 유저의 `user_id`
- `created_at` 그룹 생성 일시

### group_members
```
group_members (id, group_id FK, user_id FK NULLABLE, pending_name NULLABLE, role, joined_at)
```
- `id` 그룹멤버에게 자동으로 생성되는 내부 식별자
   - 그룹 생성 시
   - 그룹에 멤버 등록 시
   - 초대코드에서 그룹으로 들어올 때
- `group_id FK`
- `user_id FK`
- `pending_name` 초대 유저가 임의로 등록한 유저 이름
   - `user_id`가 NULL 인 경우 (대기자 인 경우) 에만 사용
   - `user_id`가 존재하는 경우 NULL 처리
- `role`: owner | member
- `joined_at`: 그룹에 들어온 일시

### expenses
```
expenses (id, group_id FK, paid_by FK, title, amount, category, receipt_image_url NULLABLE, split_type, spent_at, created_at)
```
- `id` 지출 등록 시 자동으로 생기는 내부 식별자
- `group_id FK`
- `paid_by FK` 결제자의 `group_members.id`(`user_id`가 아님)
   — 대기 중 유저도 결제자로 지정될 수 있어서, 로그인 계정 없이도 존재하는 `group_members.id`를 참조
- `title` 유저가 입력한 항목명
- `amount` 유저가 입력한 지출 금액
- `category` 카테고리 6종
   -  숙소 / 식비 / 교통 / 액티비티 / 쇼핑 / 기타
- `receipt_image_url` 영수증 사진 업로드 (NULLABLE)
- `split_type` 나누기 방식
   — equal | ratio | amount
- `spent_at` 유저가 선택한 날짜. 기본값 오늘
- `created_at` 지출 등록 일시

### expense_participants
```
expense_participants (expense_id FK, group_member_id FK, share_amount NULLABLE)
```
- `expense_id FK`
- `group_member_id FK`: 참여자의 `group_members.id`(`user_id`가 아님)
   - 대기 중 유저도 대상자로 지정될 수 있어서, 로그인 계정 없이도 존재하는 `group_members.id`를 참조
- `expense_id FK`와 `group_member_id FK`를 합쳐 PRIMARY KEY
   - 한 지출에 같은 사람이 두 번 참여자로 안 들어감
- `share_amount` NULLABLE
   - `split_type`이 equal이면 NULL, 매번 계산
   - `split_type`이 ratio/amount면 등록 시점에 정수(원 단위)로 확정해서 저장

## 마스터 데이터

지금 프로토타입 코드 안에만 있고 문서에는 없던 고정 값 목록.

- **카테고리(6종)**: 숙소 / 식비 / 교통 / 액티비티 / 쇼핑 / 기타
- **은행(18종)**: 카카오뱅크, 토스뱅크, 케이뱅크, 국민은행, 신한은행, 우리은행, 하나은행, 농협은행, 기업은행, SC제일은행, 씨티은행, 우체국, 새마을금고, 신협, 부산은행, 대구은행, 광주은행, 경남은행
- **split_type(3종)**: equal(균등) / ratio(비율) / amount(금액)
- **group_members.role(2종)**: owner / member
- **알림 type(2종)**: expense(지출 등록) / member_joined(멤버 참여)

## 잔액/정산 계산 로직 (업데이트)

1. **잔액 계산**: 멤버별 `balance = 결제 합(paid_by 기준 amount 합) - 부담 합(참여자로 지정된 지출들의 share 합)`
2. **분담액(share) 계산**
   - `equal`: `base = floor(amount / N)`, 나머지는 참여자 전체를 group_member_id 오름차순으로 정렬해 앞에서부터 1원씩 추가
   - `ratio`: 입력한 %를 원 단위로 환산(내림) 후, 남는 오차를 참여자 group_member_id 오름차순으로 1원씩 분배
   - `amount`: 입력값을 그대로 저장
3. **최소 송금 매칭**: 채권자(balance>0)·채무자(balance<0)를 각각 금액 내림차순 정렬 후 가장 큰 채권자·채무자부터 그리디 매칭
4. **카테고리별 집계**: `expenses.category`로 그룹핑해서 합산

## 화면별 데이터 사용 매핑

| 화면 | 읽는 데이터 | 쓰는 데이터 |
|---|---|---|
| 08 지출 목록 | `expenses`, `expense_participants`(참여자 수만), `group_members`(이름) | 없음(조회 전용) |
| 09 정산 | 위 잔액 계산 결과, 이름(`users.name` 또는 대기 중이면 `group_members.pending_name`), `bank_accounts`(계좌) | 없음(조회 전용, 클립보드 복사만) |
| 10 요약 | 위 잔액 계산 결과, `expenses.category` 집계, 이름(09와 동일) | 없음(조회 전용) |
| 11 지출 폼 | `group_members`(결제자/참여자 선택지) | `expenses` 신규 행 또는 수정, `expense_participants` 신규/수정/삭제 |
