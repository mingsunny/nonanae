import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

/**
 * 토스 미니앱 빌드(`--mode toss`)에서만 index.html을 고친다.
 * - 핀치 줌 막기: 앱인토스 체크리스트("지도처럼 꼭 필요한 화면이 아니면 확대·축소를 막는다"). 웹은 접근성 때문에 그대로 둔다
 * - 봇 확인(Turnstile) 서버 미리 연결 빼기: 토스 빌드는 봇 확인을 쓰지 않는다
 */
function tossHtml(): Plugin {
  return {
    name: 'nonanae-toss-html',
    transformIndexHtml(html) {
      return html
        .replace(
          /<meta name="viewport"[^>]*>/,
          '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1, user-scalable=no" />',
        )
        .replace(/\s*<!--[^>]*Turnstile[^>]*-->\s*<link rel="preconnect" href="https:\/\/challenges\.cloudflare\.com" \/>/, '')
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'toss' ? [tossHtml()] : [])],
}))
