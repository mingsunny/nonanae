import { describe, expect, it } from 'vitest'
import { generateInviteCode, INVITE_CODE_LENGTH, parseInviteCode } from './inviteCode'

describe('parseInviteCode', () => {
  it('공용 코드는 대문자로 바꾸고 대상 멤버는 없다', () => {
    expect(parseInviteCode('jeju26')).toEqual({ code: 'JEJU26', targetMemberId: null })
  })

  it('개인 초대 코드는 "코드-멤버ID"로 나뉜다 (멤버 ID는 대소문자 그대로)', () => {
    expect(parseInviteCode('test42-m_minji')).toEqual({ code: 'TEST42', targetMemberId: 'm_minji' })
  })

  it('앞뒤 공백은 무시하고, 대시 뒤가 비어 있으면 공용 코드로 본다', () => {
    expect(parseInviteCode('  TEST42-  ')).toEqual({ code: 'TEST42', targetMemberId: null })
  })
})

describe('generateInviteCode', () => {
  it('6자리이고 헷갈리는 문자(0, O, 1, I)가 없다', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateInviteCode()
      expect(code).toHaveLength(INVITE_CODE_LENGTH)
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]+$/)
    }
  })

  it('난수 함수를 주입하면 결정적으로 만든다', () => {
    expect(generateInviteCode(() => 0)).toBe('AAAAAA')
  })
})
