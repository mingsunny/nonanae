import { describe, expect, it } from 'vitest'
import { expenseAddedTitle } from './notifications'

describe('expenseAddedTitle', () => {
  it('그룹 이름과 결제자 이름을 채운다', () => {
    expect(expenseAddedTitle('제주도 여행', '박서연')).toBe('[제주도 여행]에 박서연님이 결제한 내역이 추가됐어요')
  })

  it('결제자 이름을 알 수 없으면 "누군가"로 쓴다', () => {
    expect(expenseAddedTitle('제주도 여행', '')).toBe('[제주도 여행]에 누군가님이 결제한 내역이 추가됐어요')
  })
})
