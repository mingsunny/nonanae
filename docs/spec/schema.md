# 데이터 스키마

## 엔티티 목록

- User — 이메일 가입 또는 구글·카카오 연동으로 가입한 실제 앱 사용자, 또는 닉네임+PIN으로 참여한 게스트 참가자 (`authProvider`로 구분, [conventions.md](conventions.md#정식-회원--게스트-참가자) 참고)
- Group — 정산 그룹(여행 단위)
- Member — 그룹에 속한 인원. 실제 User(정식 회원 또는 게스트)이거나, 아직 앱에 가입하지 않은 "미가입 멤버"(이름만 있는 placeholder)일 수 있음 ([12-group-invite.md](12-group-invite.md) 참고)
- Expense — 그룹 내 지출 1건
- ExpenseParticipant — 지출 1건에 대한 참여자 1명의 분담 정보
- Notification — 그룹 내 이벤트(지출 등록, 멤버 참여) 알림 1건

## User

> ✅ 로그인 방식 재확정 (2026-09-06, 카카오 단독에서 전환): **이메일+비밀번호가 기본**, 구글·카카오는 추가 연동 옵션. 이메일/구글/카카오 중 하나 이상으로 식별 가능해야 하며 셋 다 병행 보유 가능(계정 연동). 게스트 참가자는 `authProvider: 'guest'`, `email`/`kakaoId`/`googleId` 모두 null인 경량 User row로 취급 ([06-join-group.md](06-join-group.md) 참고).

로그인([01-login.md](01-login.md)) 후 최초 1회 온보딩([02-onboarding.md](02-onboarding.md))에서 생성됨. 게스트는 [06-join-group.md](06-join-group.md)의 닉네임+PIN 참여 시점에 생성됨.

| 필드 | 타입 | 설명 |
|---|---|---|
| id | string | 내부 식별자 (`uid('u')`로 생성) |
| authProvider | 'email' \| 'kakao' \| 'google' \| 'guest' | 계정을 최초로 만든 수단. 이후 다른 소셜을 추가 연동해도 이 값은 최초 가입 수단 그대로 유지 |
| email | string \| null | 정식 회원 식별자(UNIQUE). 이메일 가입·구글 연동·카카오 연동 모두 이 값으로 계정을 매칭. 게스트는 null |
| emailVerified | boolean | 이메일 인증 여부. 인증 필수화 여부는 미정([01-login.md](01-login.md) 참고) — 기본값 false |
| passwordHash | string \| null | bcrypt 해시. 이메일로 가입한 경우 필수, 구글·카카오로만 가입하고 이메일 가입 이력이 없으면 null (비밀번호 없이 소셜 로그인만 사용) |
| kakaoId | string \| null | 카카오 연동 식별자. 연동 안 했으면 null, 게스트는 null |
| googleId | string \| null | 구글 연동 식별자. 연동 안 했으면 null, 게스트는 null |
| name | string | 이름. 구글·카카오 연동 가입은 소셜 프로필 이름/닉네임으로 자동 채움, 이메일 가입은 공란에서 시작. 온보딩/프로필에서 수정 가능. 게스트는 이름 없음(Member.nickname 사용, 아래 참고) |
| bank | string \| null | 은행명. [공통 은행 목록](conventions.md#은행-목록) 중 하나. 게스트는 null |
| account | string \| null | 계좌번호. 형식 검증 없는 자유 텍스트 (현재 프로토타입 기준). 게스트는 null |
| seenGroupCreateCoach | boolean | 첫 그룹 생성 코치마크([03-group-list.md](03-group-list.md))를 이미 봤는지 여부. 1회성 안내 노출 제어용. 게스트는 해당 화면에 진입하지 않으므로 미사용 |

> `email`이 UNIQUE이므로, 구글/카카오 로그인 시 반환된 이메일이 이미 존재하는 계정과 일치하면 신규 계정을 만들지 않고 해당 계정에 `kakaoId`/`googleId`만 채워 연동 처리한다. 단, 소셜 제공자가 이메일 소유를 검증했다는 보장이 없는 경우 자동 연동은 계정 탈취 위험이 있음 — [01-login.md](01-login.md) 예외처리 참고.

## Group

그룹 목록([03-group-list.md](03-group-list.md))에서 조회, 새 그룹 만들기([05-create-group.md](05-create-group.md))에서 생성됨.

| 필드 | 타입 | 설명 |
|---|---|---|
| id | string | 내부 식별자 (`uid('g')`로 생성) |
| name | string | 그룹(여행) 이름 |
| inviteCode | string | 6자리 초대코드 ([06-join-group.md](06-join-group.md), [12-group-invite.md](12-group-invite.md)에서 사용) |
| members | Member[] | 그룹에 속한 인원 목록 |
| expenses | Expense[] | 그룹 내 지출 목록 |

> 그룹의 "총 지출", "멤버 수" 등은 별도 필드로 저장하지 않고 `members`/`expenses`를 매번 계산해서 표시함.

## Member

그룹과 참여자를 잇는 관계 엔티티(User와 별개). 정식 회원, 게스트, placeholder 멤버가 모두 이 엔티티로 표현됨.

| 필드 | 타입 | 설명 |
|---|---|---|
| id | string | 내부 식별자 (`uid('m')`로 생성). Expense.paidBy·ExpenseParticipant.memberId 등이 참조하는 안정적인 키 — `userId`는 placeholder일 때 null이라 FK로 못 씀 |
| userId | string \| null | 연결된 User.id. placeholder 멤버는 실제 참여 전까지 null, 참여 시 [07-join-match.md](07-join-match.md)에서 매칭되며 채워짐 |
| groupId | string | 소속 Group.id |
| role | 'owner' \| 'member' | 그룹장 여부. 게스트와 placeholder는 항상 'member' (그룹장은 정식 회원만 가능) |
| name | string | placeholder 멤버의 표시 이름 (`userId`가 null일 때 사용). 실제 참여 후에는 사용 안 함 |
| nickname | string \| null | 게스트 참가자의 그룹 내 표시 이름. 정식 회원은 null(User.name 사용) |
| pinHash | string \| null | 게스트 참가자의 PIN(4자리) 해시값. 평문 저장 금지. 정식 회원·placeholder는 null |
| failedAttempts | number | 게스트 PIN 재입장 실패 누적 횟수. 5회 도달 시 잠금 (기본값 0) |
| lockedUntil | timestamp \| null | 게스트 PIN 잠금이 풀리는 시각. 잠금 아닐 때 null |
| joinedAt | timestamp | 그룹 참여 시각 |

> `nickname`은 그룹 내 unique 제약 필요 — 같은 그룹에 동일 닉네임의 게스트가 둘 생기면 재입장 매칭이 모호해짐.

> **화면에 표시할 이름 결정 순서**(08~13 전반에서 공통으로 씀): `userId`가 null이면 placeholder → `Member.name`. `userId`가 있고 `nickname`도 있으면 게스트 → `Member.nickname`. `userId`가 있고 `nickname`이 null이면 정식 회원 → `User.name`.

## Expense

지출 등록/수정 폼([11-expense-form.md](11-expense-form.md))에서 생성·수정되고, 지출 목록([08-group-expense-list.md](08-group-expense-list.md))·정산([09-group-settle.md](09-group-settle.md))·요약([10-group-summary.md](10-group-summary.md))에서 조회됨.

| 필드 | 타입 | 설명 |
|---|---|---|
| id | string | 내부 식별자 (`uid('e')`로 생성) |
| groupId | string | 소속 Group.id |
| paidBy | string | 결제자의 Member.id(User.id 아님) — placeholder도 결제자로 지정될 수 있어서 항상 존재하는 Member.id를 참조 |
| title | string | 항목명 |
| amount | number | 지출 금액(원) |
| category | string | 카테고리 6종 중 하나 — [마스터 데이터](#마스터-데이터) 참고 |
| receiptImageUrl | string \| null | 영수증 사진(선택) |
| splitType | 'equal' \| 'ratio' \| 'amount' | 나누기 방식 |
| spentAt | date | 사용 날짜. 기본값 오늘 |
| createdAt | timestamp | 등록 일시 |

### ExpenseParticipant

| 필드 | 타입 | 설명 |
|---|---|---|
| expenseId | string | 소속 Expense.id |
| memberId | string | 참여자의 Member.id(User.id 아님) — placeholder도 참여자로 지정될 수 있어서 항상 존재하는 Member.id를 참조 |
| shareAmount | number \| null | 이 참여자의 분담액. `splitType`이 equal이면 null(매번 계산), ratio/amount면 등록 시점에 정수(원 단위)로 확정 저장 |

> `expenseId` + `memberId`가 합쳐서 PRIMARY KEY — 한 지출에 같은 사람이 두 번 참여자로 안 들어감.

## Notification

지출 등록, 신규 멤버 참여 이벤트를 그룹 내 사용자에게 알리는 항목. [13-notifications.md](13-notifications.md)에서 조회.

| 필드 | 타입 | 설명 |
|---|---|---|
| id | string | 내부 식별자 |
| groupId | string | 어느 그룹에서 발생한 알림인지 |
| memberId | string \| null | 이벤트를 일으킨 사람의 Member.id — 지출 등록 알림이면 결제자, 멤버 참여 알림이면 그 새 멤버 |
| type | 'expense' \| 'member_joined' | 알림 종류 — [마스터 데이터](#마스터-데이터) 참고 |
| title | string | 화면에 보여줄 문구. 생성 시점에 이름을 채워 고정 저장(이후 이름이 바뀌어도 문구는 그대로) |
| createdAt | timestamp | 생성 일시(화면엔 상대 시간으로 표시) |
| read | boolean | 읽음 여부. 기본값 false |

## 마스터 데이터

- **카테고리(6종)**: 숙소 / 식비 / 교통 / 액티비티 / 쇼핑 / 기타
- **splitType(3종)**: equal(균등) / ratio(비율) / amount(금액)
- **Notification.type(2종)**: expense(지출 등록) / member_joined(멤버 참여)
- **은행 목록**: [conventions.md](conventions.md#은행-목록) 참고

## 계산 로직

1. **잔액 계산**: 멤버별 `balance = 결제 합(paidBy 기준 amount 합) - 부담 합(참여자로 지정된 지출들의 shareAmount 합)`
2. **분담액(shareAmount) 계산**
   - `equal`: `base = floor(amount / N)`, 나머지는 참여자 전체를 memberId 오름차순으로 정렬해 앞에서부터 1원씩 추가
   - `ratio`: 입력한 %를 원 단위로 환산(내림) 후, 남는 오차를 참여자 memberId 오름차순으로 1원씩 분배
   - `amount`: 입력값을 그대로 저장
3. **최소 송금 매칭**: 채권자(balance>0)·채무자(balance<0)를 각각 금액 내림차순 정렬 후 가장 큰 채권자·채무자부터 그리디 매칭
4. **카테고리별 집계**: `Expense.category`로 그룹핑해서 합산

## 관계도

## 변경 이력

- 2026-09-06: 참가자용 닉네임+PIN 게스트 분기 결정에 따라 User의 로그인 방식을 카카오로 확정(`kakaoId`, `authProvider` 추가)하고, Member에 게스트 인증 관련 필드(`nickname`/`pinHash`/`failedAttempts`/`lockedUntil`) 추가 (민선)
- 2026-09-06: 로그인 기본 수단을 카카오 단독에서 이메일+비밀번호 기본, 구글·카카오 연동 추가로 전환. User에 `email`/`emailVerified`/`passwordHash`/`googleId` 추가, `authProvider`에 `'email'`/`'google'` 추가 (민선)
- 2026-09-10: 08~13 화면(지출/정산/요약/폼/초대/알림) 스키마를 이 문서에 통합. Member에 `id` 추가(Expense.paidBy 등이 참조할 안정적인 키가 없어서), Expense 필드 채움, ExpenseParticipant·Notification 엔티티 추가, 마스터 데이터/계산 로직 섹션 추가. 은행계좌는 별도 엔티티로 분리하지 않고 User.bank/User.account 그대로 유지
