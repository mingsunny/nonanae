/**
 * 봇 방지(Cloudflare Turnstile). 로그인·가입·비밀번호 재설정·게스트 참여(익명 로그인)처럼 Supabase Auth가 불리는 곳마다
 * 사람인지 확인한 토큰을 받아 `captchaToken`으로 넘긴다 — Supabase 대시보드에서 CAPTCHA를 켜면 토큰 없는 요청은 서버가 거절한다.
 *
 * `VITE_TURNSTILE_SITE_KEY`가 비어 있으면(목업·로컬 개발·아직 CAPTCHA를 안 켠 환경) 아무것도 하지 않고 undefined를 돌려준다.
 * 사이트 키는 공개되는 값이다(비밀 키는 Supabase 대시보드에만 넣는다).
 */

interface TurnstileApi {
  render: (container: HTMLElement, options: Record<string, unknown>) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
/** 사람이 직접 눌러야 하는 확인이 뜬 경우까지 감안한 제한 시간 */
const TIMEOUT_MS = 120_000

export const CAPTCHA_FAILED_MESSAGE = '보안 확인을 하지 못했어요. 새로고침 후 다시 시도해주세요.'

let scriptPromise: Promise<TurnstileApi> | null = null

function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile missing')))
    script.onerror = () => {
      scriptPromise = null // 일시적인 네트워크 문제면 다음 시도에서 다시 불러온다
      script.remove()
      reject(new Error('turnstile script failed'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

/**
 * 토큰 하나를 받아 돌려준다. 토큰은 한 번만 쓸 수 있어서 호출마다 새로 받는다.
 * 대개 눈에 안 보이게 끝나고, 사람 확인이 필요하면 화면 아래쪽에 위젯이 잠깐 나타난다.
 * 실패하면 CAPTCHA_FAILED_MESSAGE로 던진다.
 */
export async function getCaptchaToken(): Promise<string | undefined> {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY
  if (!siteKey) return undefined

  let turnstile: TurnstileApi
  try {
    turnstile = await loadScript()
  } catch {
    throw new Error(CAPTCHA_FAILED_MESSAGE)
  }

  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647'
  document.body.appendChild(container)

  return new Promise<string>((resolve, reject) => {
    let widgetId: string | undefined
    const finish = (done: () => void) => {
      clearTimeout(timer)
      if (widgetId !== undefined) turnstile.remove(widgetId)
      container.remove()
      done()
    }
    const fail = () => finish(() => reject(new Error(CAPTCHA_FAILED_MESSAGE)))
    const timer = setTimeout(fail, TIMEOUT_MS)
    try {
      widgetId = turnstile.render(container, {
        sitekey: siteKey,
        appearance: 'interaction-only', // 사람 확인이 필요할 때만 보인다
        callback: (token: string) => finish(() => resolve(token)),
        'error-callback': fail,
        'timeout-callback': fail,
      })
    } catch {
      fail()
    }
  })
}

/** supabase-js auth 호출의 options에 펼쳐 넣는다. 토큰이 없으면(CAPTCHA 미사용) 빈 객체. */
export function captchaOptions(token: string | undefined): { captchaToken?: string } {
  return token ? { captchaToken: token } : {}
}
