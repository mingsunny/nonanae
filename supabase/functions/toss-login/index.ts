// 토스 로그인 → Supabase 세션. 토스 미니앱의 "토스로 시작하기"가 부른다.
//   1) 앱이 준 인가 코드로 토스 AccessToken을 받고 (generate-token)
//   2) 그 토큰으로 사용자 키(userKey)를 받는다 (login-me). 이름·전화번호 같은 개인정보는 받지도 저장하지도 않는다
//   3) userKey에 연결된 Supabase 계정을 찾고, 없으면 만든다 (이메일은 실제로 쓰지 않는 내부용 주소)
//   4) 그 계정의 한 번 쓰는 로그인 토큰(token_hash)을 돌려준다 → 앱이 verifyOtp로 세션을 연다
// 배포: supabase functions deploy toss-login --no-verify-jwt   (로그인 전에 부르므로 JWT 확인을 끈다)
// 비밀값: TOSS_MTLS_CERT, TOSS_MTLS_KEY, TOSS_APP_NAME (_shared/toss.ts). SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY는 기본 제공
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, requireEnv, tossApi } from '../_shared/toss.ts'

const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })

/** 토스 사용자의 Supabase 계정에 붙이는 내부용 이메일. 메일을 보내지 않으며, 존재하지 않는 도메인(.invalid)을 쓴다 */
const internalEmail = (userKey: number) => `toss-${userKey}@toss.nonanae.invalid`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, 405, { error: 'method not allowed' })

  try {
    const { authorizationCode, referrer } = await req.json()
    if (typeof authorizationCode !== 'string' || typeof referrer !== 'string') {
      return json(req, 400, { error: 'authorizationCode와 referrer가 필요해요' })
    }

    const token = await tossApi<{ accessToken: string }>('/api-partner/v1/apps-in-toss/user/oauth2/generate-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorizationCode, referrer }),
    })
    const me = await tossApi<{ userKey: number }>('/api-partner/v1/apps-in-toss/user/oauth2/login-me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token.accessToken}` },
    })
    const userKey = me.userKey

    const admin = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const email = await findOrCreateAccount(admin, userKey)

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (linkError || !link.properties?.hashed_token) throw new Error(`로그인 토큰 발급 실패: ${linkError?.message}`)

    return json(req, 200, { tokenHash: link.properties.hashed_token })
  } catch (err) {
    console.error('[toss-login]', err instanceof Error ? err.message : err)
    return json(req, 500, { error: '토스 로그인을 처리하지 못했어요' })
  }
})

// deno-lint-ignore no-explicit-any
type Admin = any

/** userKey에 연결된 계정의 이메일. 처음이면 계정을 만들고 연결한다 (동시에 두 번 들어와도 하나만 남게) */
async function findOrCreateAccount(admin: Admin, userKey: number): Promise<string> {
  const existing = await linkedEmail(admin, userKey)
  if (existing) return existing

  const email = internalEmail(userKey)
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { provider: 'toss' },
  })
  if (createError) {
    // 같은 사람이 거의 동시에 로그인해서 이미 만들어졌거나, 연결 기록만 지워진 경우: 다시 찾아본다
    const again = await linkedEmail(admin, userKey)
    if (again) return again
    throw new Error(`계정 생성 실패: ${createError.message}`)
  }

  const { error: linkError } = await admin.from('toss_accounts').insert({ user_key: userKey, user_id: created.user.id })
  if (linkError) {
    // 동시에 만든 다른 요청이 먼저 연결했다면 방금 만든 계정은 지우고 그쪽을 쓴다
    await admin.auth.admin.deleteUser(created.user.id)
    const again = await linkedEmail(admin, userKey)
    if (again) return again
    throw new Error(`계정 연결 실패: ${linkError.message}`)
  }
  return email
}

async function linkedEmail(admin: Admin, userKey: number): Promise<string | null> {
  const { data, error } = await admin.from('toss_accounts').select('user_id').eq('user_key', userKey).maybeSingle()
  if (error) throw new Error(`연결 조회 실패: ${error.message}`)
  if (!data) return null
  const { data: user, error: userError } = await admin.auth.admin.getUserById(data.user_id)
  if (userError || !user.user?.email) throw new Error(`계정 조회 실패: ${userError?.message}`)
  return user.user.email
}
