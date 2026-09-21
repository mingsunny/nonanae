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
