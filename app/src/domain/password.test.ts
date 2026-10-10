import { describe, expect, it } from 'vitest'
import { passwordProblem } from './password'

describe('passwordProblem', () => {
  it('8자 미만이면 길이 문구', () => {
    expect(passwordProblem('abc123')).toMatch('8자')
  })
  it('영문이나 숫자가 빠지면 조합 문구', () => {
    expect(passwordProblem('abcdefgh')).toMatch('영문과 숫자')
    expect(passwordProblem('12345678')).toMatch('영문과 숫자')
  })
  it('규칙에 맞으면 null', () => {
    expect(passwordProblem('abcd1234')).toBeNull()
  })
})
