import { describe, expect, it } from 'vitest'
import { NAME_MAX_LENGTH, NAME_TOO_LONG_MESSAGE, assertNameLength, isNameTooLong } from './name'

describe('이름 길이 한도', () => {
  it('한도는 20자이고 안내 문구에 같은 숫자가 들어간다', () => {
    expect(NAME_MAX_LENGTH).toBe(20)
    expect(NAME_TOO_LONG_MESSAGE).toBe('이름은 20자 이하로 입력해주세요.')
  })

  it('20자까지는 되고 21자부터 넘는다', () => {
    expect(isNameTooLong('가'.repeat(20))).toBe(false)
    expect(isNameTooLong('가'.repeat(21))).toBe(true)
  })

  it('앞뒤 공백은 세지 않는다 (저장할 때 다듬어지므로)', () => {
    expect(isNameTooLong(`  ${'가'.repeat(20)}  `)).toBe(false)
  })

  it('이모지처럼 코드 두 개짜리 글자도 한 글자로 센다 (DB의 char_length와 같은 기준)', () => {
    expect(isNameTooLong('😀'.repeat(20))).toBe(false)
    expect(isNameTooLong('😀'.repeat(21))).toBe(true)
  })

  it('assertNameLength는 넘으면 안내 문구로 던진다', () => {
    expect(() => assertNameLength('가'.repeat(21))).toThrow(NAME_TOO_LONG_MESSAGE)
    expect(() => assertNameLength('가'.repeat(20))).not.toThrow()
  })
})
