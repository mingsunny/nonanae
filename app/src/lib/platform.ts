/**
 * 어느 플랫폼용 빌드인지. 토스 미니앱 번들은 `npm run build:toss`(= `vite build --mode toss`)로 만들고,
 * 그때 `.env.toss`의 `VITE_TARGET=toss`가 켜진다. 웹(Vercel) 빌드는 그대로 false.
 *
 * 토스 미니앱에서는 앱인토스 정책에 맞춰
 * - 로그인은 토스 로그인만 (이메일 가입·로그인, 비밀번호 재설정, 게스트(로그인 없이) 참여 없음)
 * - 봇 확인(Turnstile, 외부 iframe) 없음
 * - 외부 사이트(구글폼) 링크 없음
 * - 초대 링크는 토스 공유 링크(`intoss://...`)
 *
 * 상수가 아니라 함수인 이유: 테스트에서 `vi.stubEnv('VITE_TARGET', 'toss')`로 바꿔 끼울 수 있게.
 */
export function isTossBuild(): boolean {
  return import.meta.env.VITE_TARGET === 'toss'
}

/** 앱인토스 콘솔에 등록한 앱 이름. `intoss://{appName}/...` 딥링크에 쓴다 (apps-in-toss.config.ts의 appName과 같아야 함) */
export function tossAppName(): string {
  return import.meta.env.VITE_TOSS_APP_NAME || 'nonanae'
}
