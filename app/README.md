# 노나내 앱 (React + Vite + TypeScript)

프로토타입(`../prototypes/`)을 React로 옮기는 프론트엔드. 스펙은 `../docs/spec/`, 디자인은 `../DESIGN.md`.

## 실행

```bash
npm install
npm run dev      # 개발 서버
npm run build    # 타입 체크 + 빌드
npm run lint
```

## 구조

```
src/
  routes/       paths.ts(URL 경로 단일 출처), router.tsx(경로 ↔ 화면)
  layouts/      화면 공용 틀 (GroupLayout: 08/09/10 헤더 + 하단 탭바)
  pages/        화면 1개 = 파일 1개 (지금은 PagePlaceholder 자리표시자)
  components/common/  여러 화면이 함께 쓰는 컴포넌트
  api/          데이터 접근 계층 (지금은 비어 있음. 화면은 여기 함수만 호출 → 나중에 Supabase로 교체)
  styles/       tokens.css(DESIGN.md 토큰), global.css
```

- 스타일은 CSS Modules(`*.module.css`) + `tokens.css`의 CSS 변수.
- URL 경로는 `docs/spec/conventions.md`의 표를 따른다. 화면 이동은 `paths`를 통해서만.
- 담당: 01~07·14 민선 / 08~13 케이디.
