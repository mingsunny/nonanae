/**
 * 봇 방지(Cloudflare Turnstile). 로그인·가입·비밀번호 재설정·게스트 참여(익명 로그인)처럼 Supabase Auth가 불리는 곳마다
 * 사람인지 확인한 토큰을 받아 `captchaToken`으로 넘긴다 — Supabase 대시보드에서 CAPTCHA를 켜면 토큰 없는 요청은 서버가 거절한다.
 *
 * `VITE_TURNSTILE_SITE_KEY`가 비어 있으면(목업·로컬 개발·아직 CAPTCHA를 안 켠 환경) 아무것도 하지 않고 undefined를 돌려준다.
 * 사이트 키는 공개되는 값이다(비밀 키는 Supabase 대시보드에만 넣는다).
 *
 * 확인은 보통 1~3초 걸려서, 버튼을 누른 뒤에 시작하면 그만큼 가입·로그인이 느려진다.
 * 그래서 화면에 들어오면 `usePrefetchCaptcha()`로 토큰을 미리 받아 두고, 제출할 때 그 토큰을 쓴다.
 */
import { useEffect } from 'react'

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

/** Turnstile 토큰은 발급 뒤 300초 동안 유효하다. 확인을 시작한 시각부터 재므로 여유를 두고 그보다 짧게만 쓴다 */
const PREFETCH_MAX_AGE_MS = 240_000

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

/** 미리 받기 시작한 토큰 하나. 쓰면(또는 실패하면) 비운다 */
let prefetched: { promise: Promise<string>; startedAt: number } | null = null

function isFresh(entry: { startedAt: number }): boolean {
  return Date.now() - entry.startedAt < PREFETCH_MAX_AGE_MS
}

/**
 * 제출 전에 토큰을 미리 받아 둔다. 이미 받고 있거나 받아 둔 게 아직 유효하면 아무것도 하지 않는다.
 * 실패해도 조용히 버린다 — 제출할 때 getCaptchaToken()이 다시 받는다.
 */
export function prefetchCaptchaToken(): void {
  if (!import.meta.env.VITE_TURNSTILE_SITE_KEY) return
  if (prefetched && isFresh(prefetched)) return
  const entry = { promise: requestToken(import.meta.env.VITE_TURNSTILE_SITE_KEY), startedAt: Date.now() }
  entry.promise.catch(() => {
    if (prefetched === entry) prefetched = null
  })
  prefetched = entry
}

/** 화면에 들어올 때 토큰을 미리 받는다. enabled가 false면(예: 이미 로그인해 확인이 필요 없음) 받지 않는다 */
export function usePrefetchCaptcha(enabled = true): void {
  useEffect(() => {
    if (enabled) prefetchCaptchaToken()
  }, [enabled])
}

/**
 * 토큰 하나를 돌려준다. 토큰은 한 번만 쓸 수 있어서, 미리 받아 둔 게 있으면 그걸 꺼내 쓰고 없으면 새로 받는다.
 * 대개 눈에 안 보이게 끝나고, 사람 확인이 필요하면 화면 아래쪽에 위젯이 잠깐 나타난다.
 * 실패하면 CAPTCHA_FAILED_MESSAGE로 던진다.
 */
export async function getCaptchaToken(): Promise<string | undefined> {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY
  if (!siteKey) return undefined

  const ready = prefetched
  prefetched = null
  if (ready && isFresh(ready)) {
    try {
      return await ready.promise
    } catch {
      // 미리 받던 확인이 실패했으면 새로 받는다
    }
  }
  return requestToken(siteKey)
}

async function requestToken(siteKey: string): Promise<string> {
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
