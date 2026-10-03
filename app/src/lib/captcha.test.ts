// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CAPTCHA_FAILED_MESSAGE, captchaOptions, getCaptchaToken } from './captcha'

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
