import { describe, expect, it } from 'vitest'
import { isRecoveryHash } from './supabase'

describe('isRecoveryHash', () => {
  it('재설정 메일 링크로 돌아온 주소를 알아본다', () => {
    expect(isRecoveryHash('#access_token=abc&expires_in=3600&refresh_token=def&token_type=bearer&type=recovery')).toBe(true)
    expect(isRecoveryHash('#type=recovery')).toBe(true)
  })

  it('만료·이미 사용한 링크(에러)도 재설정 링크로 본다', () => {
    expect(
      isRecoveryHash('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'),
    ).toBe(true)
  })

  it('그 밖의 주소는 아니다', () => {
    expect(isRecoveryHash('')).toBe(false)
    expect(isRecoveryHash('#section-2')).toBe(false)
    expect(isRecoveryHash('#access_token=abc&type=signup')).toBe(false)
    expect(isRecoveryHash('#retype=recovery-not')).toBe(false)
  })
})
