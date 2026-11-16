// 토스 "연결 끊기" 콜백. 사용자가 토스 앱에서 노나내 연결을 끊거나(UNLINK), 토스 로그인 약관을 철회하거나(WITHDRAWAL_TERMS),
// 토스를 탈퇴하면(WITHDRAWAL_TOSS) 토스 서버가 이 주소를 부른다 → 그 사람의 노나내 계정을 탈퇴 처리한다.
// (앱인토스 체크리스트: "연결을 끊으면 미니앱에 사용자 데이터가 남지 않아요")
//
// 콘솔 설정: 토스 로그인 → 연결 끊기 콜백
//   URL     https://<프로젝트>.supabase.co/functions/v1/toss-unlink
//   메서드  POST (GET도 받는다)
//   Basic Auth  콘솔에 넣은 값과 같은 값을 비밀값 TOSS_UNLINK_BASIC_AUTH 에 넣는다 (예: nonanae:긴임의문자열)
// 배포: supabase functions deploy toss-unlink --no-verify-jwt   (토스 서버가 부르므로 Supabase JWT가 없다)
import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireEnv } from '../_shared/toss.ts'

/** Authorization: Basic base64(...) 를 디코딩해 콘솔에 넣은 값과 비교 */
function authorized(req: Request): boolean {
  const header = req.headers.get('authorization') ?? ''
  if (!header.startsWith('Basic ')) return false
  try {
    return atob(header.slice('Basic '.length).trim()) === requireEnv('TOSS_UNLINK_BASIC_AUTH')
  } catch {
    return false
  }
}

async function readParams(req: Request): Promise<{ userKey: number | null; referrer: string }> {
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const key = Number(url.searchParams.get('userKey'))
    return { userKey: Number.isFinite(key) && key > 0 ? key : null, referrer: url.searchParams.get('referrer') ?? '' }
  }
  const body = await req.json().catch(() => ({}))
  const key = Number(body.userKey)
  return { userKey: Number.isFinite(key) && key > 0 ? key : null, referrer: String(body.referrer ?? '') }
}

Deno.serve(async (req) => {
  if (!authorized(req)) return new Response('unauthorized', { status: 401 })

  const { userKey, referrer } = await readParams(req)
  if (userKey === null) return new Response('userKey required', { status: 400 })

  const admin = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await admin.from('toss_accounts').select('user_id').eq('user_key', userKey).maybeSingle()
  if (error) {
    console.error('[toss-unlink] 조회 실패', error.message)
    return new Response('error', { status: 500 })
  }
  // 이미 탈퇴했거나 노나내에 가입한 적 없는 사람: 할 일이 없다
  if (!data) return new Response('ok')

  const { error: deleteError } = await admin.rpc('delete_account_by_id', { p_user_id: data.user_id })
  if (deleteError) {
    console.error('[toss-unlink] 탈퇴 처리 실패', deleteError.message)
    return new Response('error', { status: 500 })
  }
  console.log('[toss-unlink] 탈퇴 처리', referrer)
  return new Response('ok')
})
