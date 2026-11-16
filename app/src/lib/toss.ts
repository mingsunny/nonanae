/**
 * 앱인토스 SDK 호출을 한곳에 모은다. SDK는 토스 앱 안(WebView)에서만 동작해서, 웹 빌드 번들에 섞이지 않도록
 * 필요할 때만 동적 import 한다 — 웹(Vercel) 빌드에서는 이 함수들이 불리지 않는다.
 */
import { tossAppName } from './platform'

const OG_IMAGE_URL = 'https://nonanae.vercel.app/intro/og.png'

/** 토스 로그인(약관 동의 화면 포함). 받은 인가 코드는 서버(Edge Function toss-login)에서 토큰으로 바꾼다 */
export async function requestTossLogin(): Promise<{ authorizationCode: string; referrer: string }> {
  const { TossAuth } = await import('@apps-in-toss/web-framework')
  return TossAuth.login()
}

/**
 * 앱 안 경로(예: `/join?code=ABCDEF`)를 토스 앱에서 열리는 공유 링크로 바꾼다.
 * 출시 전(콘솔 QR 테스트)에는 `intoss://` 링크가 열리지 않는다 — 앱인토스 정책상 정상이다.
 */
export async function createTossShareLink(appPath: string): Promise<string> {
  const { Share } = await import('@apps-in-toss/web-framework')
  const path = `intoss://${tossAppName()}${appPath.startsWith('/') ? appPath : `/${appPath}`}`
  return Share.createLink({ path, ogImageUrl: OG_IMAGE_URL })
}

/** 토스의 공유 시트(카카오톡·문자 등 선택)를 연다 */
export async function openTossShareSheet(message: string): Promise<void> {
  const { Share } = await import('@apps-in-toss/web-framework')
  await Share.sendMessage({ message })
}
