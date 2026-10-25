// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CAPTCHA_FAILED_MESSAGE, captchaOptions, getCaptchaToken, prefetchCaptchaToken } from './captcha'

interface RenderOptions {
  sitekey: string
  callback: (token: string) => void
  'error-callback': () => void
}

function installTurnstile(onRender: (options: RenderOptions) => void) {
  const remove = vi.fn()
  const render = vi.fn((_container: HTMLElement, options: RenderOptions) => {
    queueMicrotask(() => onRender(options))
    return 'widget-1'
  })
  window.turnstile = { render, remove } as unknown as Window['turnstile']
  return { render, remove }
}

beforeEach(() => {
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key')
})

afterEach(() => {
  vi.unstubAllEnvs()
  delete window.turnstile
  document.body.innerHTML = ''
})

describe('getCaptchaToken', () => {
  it('사이트 키가 없으면 위젯 없이 undefined (CAPTCHA 미사용 환경)', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '')
    const { render } = installTurnstile(() => {})
    await expect(getCaptchaToken()).resolves.toBeUndefined()
    expect(render).not.toHaveBeenCalled()
  })

  it('위젯이 준 토큰을 돌려주고, 위젯과 컨테이너를 정리한다', async () => {
    const { render, remove } = installTurnstile((o) => o.callback('token-abc'))
    await expect(getCaptchaToken()).resolves.toBe('token-abc')
    expect(render.mock.calls[0][1].sitekey).toBe('site-key')
    expect(remove).toHaveBeenCalledWith('widget-1')
    expect(document.body.children).toHaveLength(0)
  })

  it('호출마다 새 토큰을 받는다 (토큰은 한 번만 쓸 수 있다)', async () => {
    let n = 0
    const { render } = installTurnstile((o) => o.callback(`t-${++n}`))
    expect(await getCaptchaToken()).toBe('t-1')
    expect(await getCaptchaToken()).toBe('t-2')
    expect(render).toHaveBeenCalledTimes(2)
  })

  it('확인에 실패하면 안내 문구로 던지고 정리한다', async () => {
    const { remove } = installTurnstile((o) => o['error-callback']())
    await expect(getCaptchaToken()).rejects.toThrow(CAPTCHA_FAILED_MESSAGE)
    expect(remove).toHaveBeenCalled()
    expect(document.body.children).toHaveLength(0)
  })
})

describe('captchaOptions', () => {
  it('토큰이 있을 때만 captchaToken을 담는다', () => {
    expect(captchaOptions('abc')).toEqual({ captchaToken: 'abc' })
    expect(captchaOptions(undefined)).toEqual({})
  })
})

describe('prefetchCaptchaToken (미리 받아 두기)', () => {
  it('미리 받아 둔 토큰을 제출 때 바로 쓰고, 그다음 제출은 새로 받는다', async () => {
    let n = 0
    const { render } = installTurnstile((o) => o.callback(`t-${++n}`))
    prefetchCaptchaToken()
    await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(1))
    expect(await getCaptchaToken()).toBe('t-1')
    expect(render).toHaveBeenCalledTimes(1) // 새 위젯 없이 받아 둔 토큰을 씀
    expect(await getCaptchaToken()).toBe('t-2') // 한 번 쓴 토큰은 다시 쓰지 않는다
  })

  it('이미 받는 중이면 또 받지 않는다 (화면이 여러 번 그려져도 위젯은 하나)', async () => {
    const { render } = installTurnstile((o) => o.callback('t'))
    prefetchCaptchaToken()
    prefetchCaptchaToken()
    await getCaptchaToken()
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('미리 받기가 실패했으면 제출 때 새로 받는다', async () => {
    let calls = 0
    const { render } = installTurnstile((o) => (++calls === 1 ? o['error-callback']() : o.callback('fresh')))
    prefetchCaptchaToken()
    expect(await getCaptchaToken()).toBe('fresh')
    expect(render).toHaveBeenCalledTimes(2)
  })

  it('받아 둔 지 오래된 토큰(4분 이상)은 버리고 새로 받는다', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      let n = 0
      installTurnstile((o) => o.callback(`t-${++n}`))
      prefetchCaptchaToken()
      vi.setSystemTime(Date.now() + 241_000)
      expect(await getCaptchaToken()).toBe('t-2')
    } finally {
      vi.useRealTimers()
    }
  })

  it('사이트 키가 없으면 아무것도 하지 않는다', () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '')
    const { render } = installTurnstile(() => {})
    prefetchCaptchaToken()
    expect(render).not.toHaveBeenCalled()
  })
})
