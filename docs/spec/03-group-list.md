# 03. 그룹 목록 (홈 탭)

> 하단 탭바 중 "홈" 탭. "프로필" 탭은 별도 문서([04-profile.md](04-profile.md))에서 다룸.

> ⚠️ **게스트 참가자는 이 화면에 진입하지 않음.** 로그인 없이(이름만으로) 참여한 게스트는 "참여한 그룹 하나"에만 scope되어 있어 "내 그룹 목록"이라는 개념이 없음 — 초대코드로 참여하면 곧바로 그 그룹의 내부 화면([08-group-expense-list.md](08-group-expense-list.md))으로 진입하고, 하단 탭바도 홈/프로필 없이 그룹 내부 탭(지출/정산/요약)만 노출됨. 재입장 시 PIN 등 별도 인증은 없음(2026-09-12 확정). 배경: [PLAN-sep03-yunjung.md](../../PLAN-sep03-yunjung.md) "결정된 질문 9" 참고.

- **담당자**: 민선
- **상태**: 작성중

## 목적

로그인한 사용자가 자신이 속한 정산 그룹(여행) 목록을 한눈에 보고, 새 그룹을 만들거나 초대코드로 기존 그룹에 참여할 수 있는 앱의 기본 홈 화면.

## 주요 기능

- 내가 속한 그룹 목록 표시 (그룹명, 멤버 수, 총 지출 금액)
- 그룹 목록 항목 클릭 시 해당 그룹 내부([08-group-expense-list.md](08-group-expense-list.md))로 이동
- "＋ 새 그룹 만들기" / "초대코드 입력" 진입 버튼
- 그룹이 하나도 없는 최초 사용자에게 그룹 생성을 유도하는 1회성 코치마크(guide) 노출
- 안 읽은 알림이 있으면 종 아이콘에 점(dot) 표시, 클릭 시 알림 오버레이([13-notifications.md](13-notifications.md)) 열림
- 하단 탭바로 "프로필" 탭([04-profile.md](04-profile.md))과 전환

## 진입 경로

- 로그인/온보딩 완료 직후 (`afterAuthed()`) 자동 진입, 항상 "홈" 탭이 기본 선택
- 그룹 내부 화면에서 좌측 상단 뒤로가기(`goGlobalHome()`) 클릭 시 진입
- 프로필 탭에서 하단 탭바 "홈" 클릭 시 진입

## UI 구성요소

- 상단바: 타이틀(`groups-greeting`, "{이름}님의 그룹"), 알림 종 아이콘(`bell-btn`) + 안 읽음 표시 점(`noti-dot`)
- 퀵 액션 버튼 2개: "＋ 새 그룹 만들기"(`create-group-entry-btn`), "초대코드 입력"
- 첫 그룹 생성 유도 안내 문구(`group-create-hint`, "그룹을 만들고 정산을 시작해요") — 조건 충족 시에만 노출
- 그룹 목록(`groups-list-wrap`): 그룹별 행(썸네일 이니셜, 그룹명, "멤버 N명 · 총 ₩N")
- 하단 탭바: 홈 / 프로필 2개 탭

## 데이터

- `state.groups`: 그룹 목록. 각 그룹은 `Group` 엔티티([schema.md](schema.md#group) 참고) — `id`, `name`, `inviteCode`, `members`, `expenses`
- 그룹 요약치는 별도 저장값이 아니라 화면에서 매번 계산: 멤버 수 = `members.length`, 총 지출 = `expenses` 합계 (`groupTotal()`)
- `state.currentUser.seenGroupCreateCoach`: 첫 그룹 생성 코치마크를 이미 봤는지 여부 (User 엔티티 필드, [schema.md](schema.md#user) 참고)
- `state.notifications`: 안 읽은 알림 존재 여부만 이 화면에서 사용 (`renderNotiDot()`), 상세는 [13-notifications.md](13-notifications.md)

## 액션 & 결과

| 액션 | 결과 |
|---|---|
| 그룹 행 클릭 | 해당 그룹 내부 화면으로 이동, 지출 탭 기본 노출 |
| "＋ 새 그룹 만들기" 클릭 | 코치마크 해제 처리 후 [05-create-group.md](05-create-group.md)로 이동 |
| "초대코드 입력" 클릭 | [06-join-group.md](06-join-group.md)로 이동 |
| 종 아이콘 클릭 | 알림 오버레이([13-notifications.md](13-notifications.md)) 오픈 |
| 하단 탭 "프로필" 클릭 | [04-profile.md](04-profile.md) 탭으로 전환 |

## 예외처리

- 그룹이 하나도 없을 때: 별도의 "아직 참여한 그룹이 없어요" 같은 안내 문구를 목록 영역에 중복 노출하지 않고, 버튼 아래 안내 카드(`group-create-hint`) 하나로만 통일해서 보여줌
- 첫 그룹 생성 코치마크(버튼 pulsing 효과 + 안내 문구)는 **사용자당 1회만** 노출됨 — 그룹이 0개이면서 아직 코치마크를 안 본 경우(`!seenGroupCreateCoach`)에만 표시되고, "＋ 새 그룹 만들기"를 한 번이라도 누르면 다시 뜨지 않음
- 그룹을 만든 후 다시 그룹이 0개가 되는 경우(그룹 삭제 등)에 대한 처리는 현재 프로토타입에 정의돼 있지 않음
- (신규) 게스트는 이 화면 자체에 진입하지 않으므로 위 예외처리는 모두 정식 회원 기준 — 게스트가 여러 그룹에 참여하고 싶으면 각 그룹의 초대코드를 각각 사용해야 하고(그룹별로 별도 게스트 세션), 그룹들을 한 곳에서 모아보는 기능은 없음. 여러 그룹을 관리하고 싶은 사용자는 정식 회원으로 전환해야 함

## 연관 화면

- 하단 탭 전환: [04-profile.md](04-profile.md)
- 진입: [05-create-group.md](05-create-group.md), [06-join-group.md](06-join-group.md)
- 알림: [13-notifications.md](13-notifications.md)
- 그룹 선택 시 이동: [08-group-expense-list.md](08-group-expense-list.md) (그룹 내부)

## 변경이력

- 2026-09-06: `settlement-prototype-sep03-yunjung.html` 기준으로 최초 작성 (민선)
- 2026-09-06: 참가자용 닉네임+PIN 게스트 분기 결정에 따라 "게스트는 이 화면에 진입하지 않음"을 명시 (민선)
- 2026-09-12: 게스트 재입장 PIN 인증이 스펙에서 제외됨에 따라 관련 표현 수정 (민선)
