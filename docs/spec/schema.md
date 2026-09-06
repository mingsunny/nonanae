# 데이터 스키마

## 엔티티 목록

- User — 카카오 로그인으로 가입한 실제 앱 사용자
- Group — 정산 그룹(여행 단위)
- Member — 그룹에 속한 인원. 실제 User이거나, 아직 앱에 가입하지 않은 "미가입 멤버"(이름만 있는 placeholder)일 수 있음 ([12-group-invite.md](12-group-invite.md) 참고)
- Expense — 그룹 내 지출 1건

## User

> ⚠️ 로그인 방식(카카오 소셜 로그인 vs 자체 회원가입 등)이 아직 확정되지 않음 ([01-login.md](01-login.md) 참고). 아래 `userId`는 최종 로그인 방식이 정해지기 전까지 쓰는 범용 식별자 가정임.

로그인([01-login.md](01-login.md)) 후 최초 1회 온보딩([02-onboarding.md](02-onboarding.md))에서 생성됨.

| 필드 | 타입 | 설명 |
|---|---|---|
| id | string | 내부 식별자 (`uid('u')`로 생성) |
| userId | string | 로그인 식별자 (가칭). `state.users`에서 이 값을 key로 사용. 로그인 방식 확정 시 구체적인 형태(이메일/소셜 계정 id 등) 결정 필요 |
| name | string | 이름. 로그인 시 확보되면 자동 채움, 온보딩/프로필에서 수정 가능 |
| bank | string | 은행명. [공통 은행 목록](conventions.md#은행-목록) 중 하나 |
| account | string | 계좌번호. 형식 검증 없는 자유 텍스트 (현재 프로토타입 기준) |

## Group

## Member

## Expense

## 관계도

## 변경 이력
