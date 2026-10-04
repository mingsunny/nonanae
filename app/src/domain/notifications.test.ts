import { describe, expect, it } from 'vitest'
import { expenseAddedTitle, expenseDeletedTitle } from './notifications'

describe('expenseAddedTitle', () => {
  it('그룹 이름과 결제자 이름을 채운다', () => {
    expect(expenseAddedTitle('제주도 여행', '박서연')).toBe('[제주도 여행]에 박서연님이 결제한 내역이 추가됐어요')
  })

  it('결제자 이름을 알 수 없으면 "누군가"로 쓴다', () => {
    expect(expenseAddedTitle('제주도 여행', '')).toBe('[제주도 여행]에 누군가님이 결제한 내역이 추가됐어요')
  })
})

describe('expenseDeletedTitle', () => {
  const base = { groupName: '제주도 여행', itemTitle: '점심', amount: 30000, payerName: '박서연', deleterName: '이하준' }

  it('누가 어떤 내역(금액·결제자)을 지웠는지 채운다', () => {
    expect(expenseDeletedTitle(base)).toBe("[제주도 여행]에서 '점심' 내역(₩30,000, 결제: 박서연)을 이하준님이 삭제했어요")
  })

  it('이름을 알 수 없으면 대체 문구를 쓴다', () => {
    expect(expenseDeletedTitle({ ...base, payerName: '', deleterName: '' })).toBe(
      "[제주도 여행]에서 '점심' 내역(₩30,000, 결제: 알 수 없음)을 누군가님이 삭제했어요",
    )
  })

  it('항목명이 30자를 넘으면 줄인다', () => {
    const long = '가'.repeat(40)
    expect(expenseDeletedTitle({ ...base, itemTitle: long })).toContain(`'${'가'.repeat(30)}…'`)
    expect(expenseDeletedTitle({ ...base, itemTitle: '가'.repeat(30) })).toContain(`'${'가'.repeat(30)}'`)
  })
})
