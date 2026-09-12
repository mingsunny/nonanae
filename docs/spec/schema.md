# 데이터 스키마

## 엔티티 목록

- User — 이메일로 가입한 정식 회원. 게스트 참가자는 User가 아니라 Member로만 존재함 ([conventions.md](conventions.md#정식-회원--게스트-참가자) 참고)
- Group — 정산 그룹(여행 단위)
- Member — 그룹에 속한 인원. 정식 회원(`userId` 있음)이거나, 게스트 또는 아직 앱에 가입하지 않은 "미가입 멤버"(`userId` 없이 이름만 있는 placeholder — 게스트와 데이터 구조가 동일함) 일 수 있음 ([12-group-invite.md](12-group-invite.md) 참고)
- Expense — 그룹 내 지출 1건
- ExpenseParticipant — 지출 1건에 대한 참여자 1명의 분담 정보
- Notification — 그룹 내 이벤트(지출 등록, 멤버 참여) 알림 1건

## User

> ✅ 로그인 방식 확정 (2026-09-12, sep10 프로토타입 기준): **이메일+비밀번호만 지원, 구글·카카오 연동 로그인은 스펙에서 제외**. `googleId`/`kakaoId` 필드 삭제.
>
> ✅ 게스트 모델 확정 (2026-09-12): 게스트는 `User` row를 아예 만들지 않음 — PIN 등 별도 인증도 없음. 초대코드로 참여할 때 이름만 입력하면 `Member`(아래 참고)로만 존재함. 자세한 내용은 [06-join-group.md](06-join-group.md) 참고.

로그인([01-login.md](01-login.md)) 후 최초 1회 온보딩([02-onboarding.md](02-onboarding.md))에서 생성됨. 게스트는 [06-join-group.md](06-join-group.md)의 초대코드 참여 시점에 생성됨.

| 필드 | 타입 | 설명 |
|---|---|---|
| id | string | 내부 식별자 (`uid('u')`로 생성) |
| authProvider | 'email' | 계정 종류. 항상 'email' (구글·카카오 연동은 스펙에서 제외, 2026-09-12). 게스트는 `User` row 자체가 없으므로 이 값이 필요 없음 |
| email | string | 회원 식별자(UNIQUE) |
| emailVerified | boolean | 이메일 인증 여부. 인증 필수화 여부는 미정([01-login.md](01-login.md) 참고) — 기본값 false |
| passwordHash | string | bcrypt 해시 |
| name | string | 이름. 회원가입 시 직접 입력, 온보딩/프로필에서 수정 가능 |
| bank | string \| null | 은행명. [공통 은행 목록](conventions.md#은행-목록) 중 하나. 게스트는 null |
| account | string \| null | 계좌번호. 형식 검증 없는 자유 텍스트 (현재 프로토타입 기준). 게스트는 null |
| seenGroupCreateCoach | boolean | 첫 그룹 생성 코치마크([03-group-list.md](03-group-list.md))를 이미 봤는지 여부. 1회성 안내 노출 제어용. 게스트는 해당 화면에 진입하지 않으므로 미사용 |

> `email`은 회원가입 시 중복 체크로만 쓰이는 UNIQUE 식별자. 소셜 로그인 연동이 없어 계정 자동 매칭/탈취 위험 시나리오는 해당 없음.

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
| id | string | 내부 식별자 (`uid('m')`로 생성). Expense.paidBy·ExpenseParticipant.memberId 등이 참조하는 안정적인 키 — `userId`는 placeholder/게스트일 때 null이라 FK로 못 씀 |
| userId | string \| null | 연결된 User.id. placeholder 멤버와 게스트는 `userId`가 없음(둘 다 계정 자체가 없음) — 정식 회원으로 참여/전환될 때만 채워짐 |
| groupId | string | 소속 Group.id |
| role | 'owner' \| 'member' | 그룹장 여부. 게스트와 placeholder는 항상 'member' (그룹장은 정식 회원만 가능) |
| name | string \| null | 표시 이름. `userId`가 null일 때(placeholder 또는 게스트) 사용, 정식 회원은 null(User.name 사용) |
| joinedAt | timestamp | 그룹 참여 시각 |

> ✅ 2026-09-12 확정: 게스트는 별도 `User` row나 PIN 없이, 이 `Member` 테이블에 `userId: null` + `name`만으로 표현됨 — placeholder 멤버와 데이터 구조가 완전히 동일함(초대에 응해서 "실제로 참여"했는지 여부만 다름). 재입장 시에도 그룹 멤버 목록에서 이름을 다시 고르면 그 Member로 인식되며 별도 인증 없음(스푸핑 방지 장치 없음 — 수용된 트레이드오프).
>
> **화면에 표시할 이름 결정 순서**(08~13 전반에서 공통으로 씀): `userId`가 null이면(placeholder 또는 게스트) → `Member.name`. `userId`가 있으면 정식 회원 → `User.name`.

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
- 2026-09-12: sep10 프로토타입 기준으로 **구글·카카오 연동 로그인을 스펙에서 제외**. User에서 `googleId`/`kakaoId` 필드 삭제, 소셜 계정 자동 연동/탈취 위험 관련 서술 삭제 (민선)
- 2026-09-12: **게스트 재입장 PIN 인증을 스펙에서 제외** 확정. 게스트는 `User` row 자체를 만들지 않는 것으로 모델 단순화 — User.authProvider에서 `'guest'` 제거(항상 `'email'`), Member에서 `nickname`/`pinHash`/`failedAttempts`/`lockedUntil` 필드 삭제(게스트는 placeholder와 동일하게 `userId: null` + `name`으로만 표현). "이름 표시 순서"를 2단계(`userId` 없음→Member.name, 있음→User.name)로 단순화 (민선)
