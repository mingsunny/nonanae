// 앱인토스 파트너 API 호출 공통. 모든 호출은 콘솔에서 발급한 mTLS 인증서로 한다.
// 비밀값(Supabase 대시보드 → Edge Functions → Secrets):
//   TOSS_MTLS_CERT  콘솔에서 받은 <이름>_public.crt 파일 내용 전체 (-----BEGIN CERTIFICATE----- 포함)
//   TOSS_MTLS_KEY   <이름>_private.key 파일 내용 전체
//   TOSS_APP_NAME   콘솔에 등록한 앱 이름 (CORS 허용 주소에 씀)

const TOSS_API = 'https://apps-in-toss-api.toss.im'

export function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`환경변수 ${name}가 없어요`)
  return value
}

let client: Deno.HttpClient | null = null

/** mTLS 클라이언트. 인증서는 비밀값으로 넣을 때 줄바꿈이 \n 글자로 들어오는 경우가 있어 되돌린다 */
function mtlsClient(): Deno.HttpClient {
  client ??= Deno.createHttpClient({
    cert: requireEnv('TOSS_MTLS_CERT').replaceAll('\\n', '\n'),
    key: requireEnv('TOSS_MTLS_KEY').replaceAll('\\n', '\n'),
  })
  return client
}

interface TossResponse<T> {
  resultType: 'SUCCESS' | 'FAIL'
  success?: T
  error?: { errorCode?: string; reason?: string }
}

/** 앱인토스 API 호출. 업무 오류도 HTTP 200 + resultType: FAIL로 오므로 둘 다 확인한다 */
export async function tossApi<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${TOSS_API}${path}`, { ...init, client: mtlsClient() })
  const body = (await res.json().catch(() => null)) as TossResponse<T> | null
  if (!res.ok || !body || body.resultType !== 'SUCCESS' || body.success === undefined) {
    throw new Error(`toss api ${path} 실패: ${res.status} ${body?.error?.errorCode ?? ''} ${body?.error?.reason ?? ''}`)
  }
  return body.success
}

/** 토스 미니앱 주소에서 오는 요청만 허용 (실서비스 / 콘솔 QR 테스트). SDK 3.1.0 이상 기준 */
export function corsHeaders(req: Request): Record<string, string> {
  const appName = Deno.env.get('TOSS_APP_NAME') ?? 'nonanae'
  const allowed = [`https://${appName}.apps.tossmini.com`, `https://${appName}.private-apps.tossmini.com`]
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}
