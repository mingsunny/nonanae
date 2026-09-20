# 노나내 앱 (React + Vite + TypeScript)

프로토타입(`../prototypes/`)을 React로 옮기는 프론트엔드. 스펙은 `../docs/spec/`, 디자인은 `../DESIGN.md`.

## 실행

```bash
npm install
npm run dev      # 개발 서버
npm run build    # 타입 체크 + 빌드
npm run lint
npm test         # 정산 계산 등 단위 테스트(vitest)
```

## 구조

```
src/
  routes/       paths.ts(URL 경로 단일 출처), router.tsx(경로 ↔ 화면), RequireUser.tsx(로그인 필요 화면 가드)
  layouts/      화면 공용 틀 (GroupLayout: 08/09/10 헤더 + 하단 탭바, HomeLayout: 03/04 인사말·알림 종 + 하단 홈/프로필 탭바)
  pages/        화면 1개 = 파일 1개. 여러 단계로 나뉘는 화면은 폴더에 단계별 화면을 둠 (01·02는 auth/, 06·07은 join/)
  components/common/         여러 화면이 함께 쓰는 컴포넌트 (Button, Avatar, Toast, EmptyState, Topbar, Callout, Field 스타일 등)
  components/notifications/  13 알림: HomeLayout 상단의 <NotificationBell />이 종 아이콘 + 알림 패널을 담당
  lib/          format(금액·날짜·상대시간), clipboard
  domain/       타입(types.ts), 정산 계산(settlement.ts), 지출 폼 계산(expenseForm.ts), 초대코드(inviteCode.ts) — 순수 함수 + 테스트. 출처: docs/spec/schema.md
  api/          데이터 접근 계층. 화면/스토어는 여기 함수만 호출 (지금은 mockDb.ts/mockSeed.ts의 목업, 나중에 Supabase로 교체)
  store/        zustand 스토어(appStore.ts): 세션·그룹·알림 상태와 로그인/가입/프로필/그룹 생성/초대 참여/지출/멤버/알림 액션, hooks.ts(useCurrentGroup·useGroupView), toastStore.ts(showToast)
  styles/       tokens.css(DESIGN.md 토큰), global.css
```

- 상태관리는 zustand, 정산 계산은 프론트에서 수행(`schema.md` 계산 로직).
- 스타일은 CSS Modules(`*.module.css`) + `tokens.css`의 CSS 변수.
- URL 경로는 `docs/spec/conventions.md`의 표를 따른다. 화면 이동은 `paths`를 통해서만.
- 담당: 프론트 화면 전체(01~14) kady / 백엔드(Supabase) 민선.

## 목업 데이터

- 앱을 처음 열면 로그아웃 상태라 인트로(01)부터 보인다. 테스트 계정 `a@naver.com` / `aaaaaaaa`(테스트)로 로그인하면 데모 그룹 "제주도 여행"(멤버 4명, 지출 6건, 알림 2건)의 방장이다. 데모 지출 날짜는 고정이 아니라 오늘 기준(오늘·어제·이틀 전)이라, 새로 등록한 지출(기본 날짜=오늘)과 같은 날짜 묶음에 나온다. 로그인할 수 있는 계정은 이 계정과 새로 가입한 계정뿐이다(데모 유저들은 이름만 있음).
- "초대코드 테스트방"(`TEST42`)에는 대기 중 멤버 "김민지"가 있고, 테스트 계정은 멤버가 아니다 (06/07 참여 흐름 확인용). 개인 초대 링크는 `/join?code=TEST42-m_minji`.
- 비밀번호 재설정(14)은 메일을 보낼 수 없어서, 가입된 이메일로 요청하면 개발 서버 브라우저 콘솔에 재설정 링크(`?token=`)가 찍힌다. 링크는 30분 동안, 1회만 쓸 수 있다.
- 상태는 localStorage(`nonanae:mock-db:v1`)에 저장된다. 처음 상태(로그아웃, 인트로부터)로 되돌리려면 개발 서버의 브라우저 콘솔에서 `window.__resetMockData()`. (저장 구조가 바뀐 이전 데이터는 자동으로 버리고 시드로 시작한다)
- 시드 정의: `src/api/mockSeed.ts` (프로토타입 sep19의 시드를 옮긴 것).

## 화면 구현 현황

| 화면 | 상태 |
|---|---|
| 01 인트로·로그인·회원가입 1단계 · 02 회원가입 2단계(계좌 등록) | 구현됨. `/login` 한 경로 안의 단계 화면 |
| 03 그룹 목록 · 04 프로필 · 05 그룹 생성 | 구현됨. 03/04는 HomeLayout(하단 홈/프로필 탭), 03~05는 로그인 필요 |
| 06 초대코드 입력 · 07 멤버 매칭 | 구현됨. `/join` 한 경로 안의 단계 화면. `?code=` 링크와 개인 초대 링크 자동 처리 |
| 08 지출 내역 · 09 정산 · 10 요약 · 11 지출 폼 · 12 멤버 초대 · 13 알림 | 구현됨 |
| 14 비밀번호 재설정 | 구현됨. 프로토타입에 UI가 없어 스펙의 표준 흐름을 따랐고, 로그인 화면에 "비밀번호를 잊으셨나요?" 링크를 추가함 |
