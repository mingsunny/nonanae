# Hand-off 문서

## 페이지별 담당자

> 프로토타입이 `settlement-prototype-sep03-yunjung.html`로 업데이트되면서 화면 구성이 바뀌어 목록을 재정리함 (2026-09-06). 초대코드 발급 완료 화면은 삭제, 프로필/초대매칭/알림 화면 신규 추가.

| 페이지 | 담당자 | 상태 |
|---|---|---|
| 01. 로그인 / 회원가입 | 민선 | 작성중 |
| 02. 프로필 설정 (온보딩) | 민선 | 작성중 (존치 여부 결정 대기) |
| 03. 그룹 목록 (홈 탭) | 민선 | 작성중 |
| 04. 프로필 (탭) | 민선 | 작성중 |
| 05. 새 그룹 만들기 | 민선 | 작성중 |
| 06. 초대코드로 참여 | | 초안 |
| 07. 초대 대기 멤버 매칭 | | 초안 |
| 08. 그룹 지출 내역 | | 초안 |
| 09. 그룹 정산 | | 초안 |
| 10. 그룹 요약 | | 초안 |
| 11. 지출 추가/수정 폼 | | 초안 |
| 12. 멤버 초대 | | 초안 |
| 13. 알림 (전역 오버레이) | | 초안 |
| 14. 비밀번호 재설정 | | 초안 |

## 작업 프로세스

## 리뷰 체크리스트

## 이슈 / 블로커

- ~~**로그인 방식 미확정**~~ → ~~해결됨: 카카오 소셜 로그인(v1)으로 확정~~ → ~~재변경됨: 이메일+비밀번호 기본 + 구글·카카오 추가 연동~~ → **재확정** (2026-09-12, sep10 프로토타입 기준): **이메일+비밀번호만 지원, 구글·카카오 연동 로그인은 스펙에서 제외**. [01-login.md](01-login.md), [02-onboarding.md](02-onboarding.md), [04-profile.md](04-profile.md), [06-join-group.md](06-join-group.md), [07-join-match.md](07-join-match.md), [14-password-reset.md](14-password-reset.md), [conventions.md](conventions.md#정식-회원--게스트-참가자), [schema.md](schema.md#user) 모두 이 기준으로 업데이트 완료. **`PLAN-sep03-yunjung.md`의 "MVP 범위" 섹션은 아직 이전 결정(구글·카카오 포함) 그대로라 갱신 필요.**
- ~~**게스트 재입장 인증(PIN) 방식 미확인**~~ → **해결됨** (2026-09-12): 기존에 결정됐던 "닉네임+PIN(5회 실패 시 잠금)" 재입장 인증을 스펙에서 제외하기로 확정. 게스트는 `User` 계정을 만들지 않고 그룹 멤버 목록에서 이름만으로 참여/재참여함(스푸핑 방지 장치 없음 — 마찰을 줄이는 쪽을 택한 트레이드오프). [01-login.md](01-login.md), [03-group-list.md](03-group-list.md), [04-profile.md](04-profile.md), [05-create-group.md](05-create-group.md), [06-join-group.md](06-join-group.md), [07-join-match.md](07-join-match.md), [08-group-expense-list.md](08-group-expense-list.md), [09-group-settle.md](09-group-settle.md), [10-group-summary.md](10-group-summary.md), [12-group-invite.md](12-group-invite.md), `conventions.md`, `schema.md`(Member.nickname/pinHash/failedAttempts/lockedUntil 필드 삭제) 모두 이 기준으로 업데이트 완료.
- **02-onboarding 화면 존치 여부 결정 필요** (2026-09-12): sep10 프로토타입은 별도 온보딩 화면 없이 회원가입 폼에서 이름/은행/계좌를 한 번에 받음. [02-onboarding.md](02-onboarding.md)를 01번에 병합/폐기할지, 요구사항 기록용으로 별도 유지할지 결정 필요.
- **14-password-reset 화면 필요 여부 재검토** (2026-09-12): sep10 로그인 화면에는 "비밀번호를 잊으셨나요?" 진입 링크 자체가 없음 — MVP에 이 화면이 필요한지 확인 필요.
- **비밀번호 재설정 화면 신규 필요** (2026-09-06): 이메일 로그인 도입에 따라 [14-password-reset.md](14-password-reset.md)를 초안으로 등록함 — 담당자 미배정, 작성 필요. (위 재검토 항목과 함께 확인)
- **이메일 인증 필수 여부 미정** (2026-09-06): 회원가입 후 이메일 인증을 강제할지, 인증 없이도 이용을 허용할지 정책 결정 필요 ([01-login.md](01-login.md) 예외처리 참고).
- ~~**참가자 비로그인 참여(게스트) 결정 반영 필요**~~ → 위 "게스트 재입장 인증(PIN)" 항목으로 통합·해결됨 (2026-09-12).
