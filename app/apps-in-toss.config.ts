import { defineConfig } from '@apps-in-toss/web-framework/config'

/**
 * 토스 미니앱(앱인토스) 설정. `npm run build:toss`가 dist를 .ait 번들로 묶을 때 읽는다.
 * appName은 앱인토스 콘솔에 등록한 앱 이름과 똑같아야 업로드된다 — 콘솔에 등록한 뒤 바꾸고,
 * `.env.toss`의 VITE_TOSS_APP_NAME도 같은 값으로 맞춘다(초대 링크 intoss://{appName}/... 에 쓰임).
 */
export default defineConfig({
  appName: 'nonanae',
  // 상단 바는 토스 기본(왼쪽 로고·이름, 오른쪽 더보기·닫기). 화면 안의 뒤로가기 버튼과 겹치지 않게 토스 뒤로가기 버튼은 끈다
  navigationBar: {
    withBackButton: false,
    theme: 'light',
  },
  webView: {
    overScrollMode: 'never',
  },
  // 초대 링크 복사(웹과 같은 동작)에 대비해 클립보드 쓰기만 요청한다
  permissions: [{ name: 'clipboard', access: 'write' }],
  webBundleDir: 'dist',
})
