// Supabase 연동 (1단계: 로그인·가입·프로필). api/index.ts가 VITE_USE_SUPABASE=true일 때만 여기로 넘겨준다.
// 로그인은 Supabase Auth, 이름·계좌 같은 프로필은 public.profiles 테이블이 맡는다 (docs/spec/schema.md "DB 구현").
import type { AuthError, User as AuthUser } from '@supabase/supabase-js'
import type { User } from '../domain/types'
import { getSupabase } from '../lib/supabase'
import type { MockSession } from './mockDb'
import type { ProfileInput, SignUpInput } from './index'

/** public.profiles 한 행 (DB는 snake_case) */
interface ProfileRow {
  id: string
  name: string
  bank: string
  account: string
  seen_group_create_coach: boolean
}

const PROFILE_COLUMNS = 'id, name, bank, account, seen_group_create_coach'

/** auth 계정(이메일)과 프로필(이름·계좌)을 합쳐 앱의 User로 만든다. */
function toUser(authUser: AuthUser, profile: ProfileRow): User {
  return {
    id: authUser.id,
    authProvider: 'email',
    email: authUser.email ?? '',
    emailVerified: authUser.email_confirmed_at != null,
    name: profile.name,
    bank: profile.bank,
    account: profile.account,
    seenGroupCreateCoach: profile.seen_group_create_coach,
  }
}

/** Supabase가 주는 영어 에러를 화면에 보여줄 한국어 문구로 바꾼다 (01/02 예외처리). */
export function authErrorMessage(error: AuthError): string {
  switch (error.code) {
    case 'invalid_credentials':
      // 미가입 이메일과 비밀번호 불일치를 구분하지 않는다 (계정 존재 여부 노출 방지)
      return '이메일 또는 비밀번호가 일치하지 않아요.'
    case 'user_already_exists':
    case 'email_exists':
      return '이미 가입된 이메일이에요. 로그인해주세요.'
    case 'weak_password':
      return '비밀번호가 너무 짧거나 쉬워요. 더 길게 만들어주세요.'
    case 'email_address_invalid':
    case 'validation_failed':
      return '이메일 형식이 올바르지 않아요'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return '요청이 너무 많아요. 잠시 후 다시 시도해주세요.'
    default:
      console.error('[supabase auth]', error)
      return '요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.'
  }
}

async function requireAuthUserId(): Promise<string> {
  const { data } = await getSupabase().auth.getSession()
  const authUser = data.session?.user
  // 게스트(익명) 세션은 프로필이 없으므로 정식 회원 전용 기능에는 쓸 수 없다
  if (!authUser || authUser.is_anonymous) throw new Error('로그인이 필요해요')
  return authUser.id
}

/** 지금 로그인한 정식 회원. 로그인 안 했거나 게스트(익명)면 null. */
async function loadSessionUser(): Promise<User | null> {
  const supabase = getSupabase()
  const { data } = await supabase.auth.getSession()
  const authUser = data.session?.user
  if (!authUser || authUser.is_anonymous) return null

  const { data: profile, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', authUser.id)
    .maybeSingle<ProfileRow>()
  if (error) throw new Error(`프로필을 불러오지 못했어요: ${error.message}`)
  // 세션은 남아 있는데 프로필이 없는 경우(탈퇴 직후 등)는 로그아웃 상태로 본다
  return profile ? toUser(authUser, profile) : null
}

/** 1단계에서는 세션과 내 프로필만 채운다. 그룹·알림은 다음 단계에서 붙인다. */
export async function fetchSnapshot(): Promise<{
  session: MockSession
  users: User[]
  groups: []
  notifications: []
}> {
  const user = await loadSessionUser()
  return {
    session: { userId: user?.id ?? null, viewAsMemberId: null },
    users: user ? [user] : [],
    groups: [],
    notifications: [],
  }
}

export async function signIn(email: string, password: string): Promise<User> {
  const supabase = getSupabase()
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw new Error(authErrorMessage(error))
  const user = await loadSessionUser()
  if (!user) throw new Error('프로필을 찾지 못했어요')
  return user
}

/**
 * 회원가입 2단계 제출. 이름·은행·계좌는 auth 메타데이터로 함께 보내고,
 * DB 트리거(handle_new_user)가 그 값으로 profiles 행을 만든다.
 */
export async function signUp(input: SignUpInput): Promise<User> {
  const name = input.name.trim()
  const account = input.account.trim()
  if (!name || !input.bank || !account) throw new Error('이름, 은행, 계좌번호를 모두 입력해주세요')

  const supabase = getSupabase()
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: { data: { name, bank: input.bank, account } },
  })
  if (error) throw new Error(authErrorMessage(error))
  // 이메일 확인이 켜져 있으면 이미 가입된 이메일도 에러 없이 돌아오는데, 그땐 identities가 비어 있다
  if (data.user?.identities?.length === 0) throw new Error('이미 가입된 이메일이에요. 로그인해주세요.')
  // 세션이 없다 = Supabase에서 "이메일 확인"이 켜져 있어 확인 메일을 눌러야 로그인됨
  if (!data.session) throw new Error('가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해주세요.')

  const user = await loadSessionUser()
  if (!user) throw new Error('프로필을 만들지 못했어요')
  return user
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut()
  if (error) throw new Error(authErrorMessage(error))
}

export async function updateProfile(input: ProfileInput): Promise<User> {
  const name = input.name.trim()
  const account = input.account.trim()
  if (!name || !input.bank || !account) throw new Error('이름, 은행, 계좌번호를 모두 입력해주세요')

  const userId = await requireAuthUserId()
  const { error } = await getSupabase()
    .from('profiles')
    .update({ name, bank: input.bank, account })
    .eq('id', userId)
  if (error) throw new Error(`저장하지 못했어요: ${error.message}`)

  const user = await loadSessionUser()
  if (!user) throw new Error('프로필을 찾지 못했어요')
  return user
}

/** 03의 "그룹을 만들고 정산을 시작해요" 안내를 본 것으로 표시(유저당 1회) */
export async function markGroupCreateCoachSeen(): Promise<void> {
  const userId = await requireAuthUserId()
  const { error } = await getSupabase()
    .from('profiles')
    .update({ seen_group_create_coach: true })
    .eq('id', userId)
  if (error) throw new Error(`저장하지 못했어요: ${error.message}`)
}
