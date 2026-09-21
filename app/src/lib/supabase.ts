import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * true면 목업 DB 대신 Supabase를 쓴다. `.env.local`에 `VITE_USE_SUPABASE=true`를 넣어 켠다(기본은 목업).
 * 테스트(vitest)는 환경변수와 상관없이 항상 목업을 쓴다 — 실수로 진짜 DB에 계정이 만들어지지 않도록.
 */
export const USE_SUPABASE = import.meta.env.VITE_USE_SUPABASE === 'true' && import.meta.env.MODE !== 'test'

let client: SupabaseClient | null = null

/** 처음 부를 때 한 번만 만든다. 키가 없으면 어느 변수가 비었는지 알려주며 실패한다. */
export function getSupabase(): SupabaseClient {
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 환경변수가 없어요 (app/.env.example 참고)')
  }
  client = createClient(url, key)
  return client
}

/**
 * 주소의 해시(#...)가 비밀번호 재설정 메일 링크를 타고 돌아온 것인지 본다.
 * 성공하면 `#access_token=...&type=recovery`, 만료·이미 사용한 링크면 `#error=...&error_code=otp_expired` 가 붙는다.
 */
export function isRecoveryHash(hash: string): boolean {
  return /[#&](type=recovery|error_code=)/.test(hash)
}

// Supabase는 링크의 토큰을 세션으로 바꾸면서 주소의 해시를 지운다. 그 전에(앱이 뜨자마자) 한 번 읽어 둔다.
const initialHash = typeof window === 'undefined' ? '' : window.location.hash
/** 이 페이지가 비밀번호 재설정 메일 링크로 열렸는지 (링크가 만료된 경우도 포함 — 그때는 세션이 없어 "만료" 안내가 뜬다) */
export const openedFromRecoveryLink = isRecoveryHash(initialHash)
