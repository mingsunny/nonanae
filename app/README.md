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
  routes/       paths.ts(URL 경로 단일 출처), router.tsx(경로 ↔ 화면)
  layouts/      화면 공용 틀 (GroupLayout: 08/09/10 헤더 + 하단 탭바)
  pages/        화면 1개 = 파일 1개 (지금은 PagePlaceholder 자리표시자)
  components/common/  여러 화면이 함께 쓰는 컴포넌트
  domain/       타입(types.ts)과 정산 계산(settlement.ts, 순수 함수 + 테스트). 출처: docs/spec/schema.md
  api/          데이터 접근 계층. 화면/스토어는 여기 함수만 호출 (지금은 mockDb.ts/mockSeed.ts의 목업, 나중에 Supabase로 교체)
  store/        zustand 스토어(appStore.ts): 세션·그룹·알림 상태와 지출/멤버/알림 액션
  styles/       tokens.css(DESIGN.md 토큰), global.css
```

- 상태관리는 zustand, 정산 계산은 프론트에서 수행(`schema.md` 계산 로직).
- 스타일은 CSS Modules(`*.module.css`) + `tokens.css`의 CSS 변수.
- URL 경로는 `docs/spec/conventions.md`의 표를 따른다. 화면 이동은 `paths`를 통해서만.
- 담당: 01~07·14 민선 / 08~13 케이디.

## 목업 데이터

- 테스트 계정 `a@naver.com`(테스트)이 로그인된 상태로 시작하고, 데모 그룹 "제주도 여행"(멤버 4명, 지출 6건, 알림 2건)에 방장으로 들어 있다.
- "초대코드 테스트방"(`TEST42`)에는 대기 중 멤버 "김민지"가 있고, 테스트 계정은 멤버가 아니다 (06/07 참여 흐름 확인용).
- 상태는 localStorage(`nonanae:mock-db:v1`)에 저장된다. 처음 상태로 되돌리려면 개발 서버의 브라우저 콘솔에서 `window.__resetMockData()`.
- 시드 정의: `src/api/mockSeed.ts` (프로토타입 sep19의 시드를 옮긴 것).
