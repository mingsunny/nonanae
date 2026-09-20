import { describe, expect, it } from 'vitest'
import {
  checkSplit,
  customSharesFromExpense,
  finalizeParticipants,
  prefillShares,
} from './expenseForm'
import type { ExpenseWithParticipants } from './types'

describe('prefillShares', () => {
  it('비율은 100%를, 금액은 총액을 균등 배분 (나머지는 memberId 오름차순)', () => {
    expect(prefillShares('ratio', 0, ['c', 'a', 'b'])).toEqual({ a: 34, b: 33, c: 33 })
    expect(prefillShares('amount', 10000, ['a', 'b', 'c'])).toEqual({ a: 3334, b: 3333, c: 3333 })
  })
})

describe('checkSplit', () => {
  it('균등은 항상 통과', () => {
    expect(checkSplit('equal', 1000, ['a'], {}).ok).toBe(true)
  })

  it('금액: 합계가 총액과 같아야 통과', () => {
    expect(checkSplit('amount', 1000, ['a', 'b'], { a: 600, b: 400 })).toEqual({
      sum: 1000,
      target: 1000,
      ok: true,
    })
    expect(checkSplit('amount', 1000, ['a', 'b'], { a: 600, b: 300 }).ok).toBe(false)
  })

  it('비율: 합계가 100%여야 통과, 소수 오차는 허용', () => {
    expect(checkSplit('ratio', 1000, ['a', 'b', 'c'], { a: 33.34, b: 33.33, c: 33.33 }).ok).toBe(true)
    expect(checkSplit('ratio', 1000, ['a', 'b'], { a: 50, b: 40 }).ok).toBe(false)
  })

  it('선택되지 않은 사람의 입력값은 합계에 넣지 않는다', () => {
    expect(checkSplit('amount', 1000, ['a'], { a: 1000, b: 500 }).ok).toBe(true)
  })
})

describe('finalizeParticipants', () => {
  it('equal: shareAmount는 null(매번 계산)', () => {
    expect(finalizeParticipants('equal', 1000, ['a', 'b'], {})).toEqual([
      { memberId: 'a', shareAmount: null },
      { memberId: 'b', shareAmount: null },
    ])
  })

  it('amount: 입력값 그대로(정수로 반올림)', () => {
    expect(finalizeParticipants('amount', 1000, ['a', 'b'], { a: 600.4, b: 400 })).toEqual([
      { memberId: 'a', shareAmount: 600 },
      { memberId: 'b', shareAmount: 400 },
    ])
  })

  it('ratio: % → 원 환산 후 오차를 분배해 합계를 총액에 맞춘다', () => {
    const rows = finalizeParticipants('ratio', 10000, ['a', 'b', 'c'], { a: 33.33, b: 33.33, c: 33.34 })
    expect(rows.reduce((s, r) => s + (r.shareAmount ?? 0), 0)).toBe(10000)
    expect(rows.map((r) => r.memberId)).toEqual(['a', 'b', 'c'])
  })
})

describe('customSharesFromExpense', () => {
  const base = { id: 'e', groupId: 'g', paidBy: 'a', title: 't', category: '식비' as const, receiptImageUrl: null, spentAt: '2026-10-01', createdAt: '' }

  it('equal은 비어 있음', () => {
    const e: ExpenseWithParticipants = { ...base, amount: 100, splitType: 'equal', participants: [{ expenseId: 'e', memberId: 'a', shareAmount: null }] }
    expect(customSharesFromExpense(e)).toEqual({})
  })

  it('amount는 저장된 원 그대로', () => {
    const e: ExpenseWithParticipants = { ...base, amount: 1000, splitType: 'amount', participants: [{ expenseId: 'e', memberId: 'a', shareAmount: 700 }, { expenseId: 'e', memberId: 'b', shareAmount: 300 }] }
    expect(customSharesFromExpense(e)).toEqual({ a: 700, b: 300 })
  })

  it('ratio는 저장된 원을 %로 되돌려 다시 저장해도 같은 금액이 나온다', () => {
    const e: ExpenseWithParticipants = { ...base, amount: 10000, splitType: 'ratio', participants: [{ expenseId: 'e', memberId: 'a', shareAmount: 3334 }, { expenseId: 'e', memberId: 'b', shareAmount: 3333 }, { expenseId: 'e', memberId: 'c', shareAmount: 3333 }] }
    const percents = customSharesFromExpense(e)
    expect(percents).toEqual({ a: 33.34, b: 33.33, c: 33.33 })
    expect(finalizeParticipants('ratio', 10000, ['a', 'b', 'c'], percents).map((r) => r.shareAmount)).toEqual([3334, 3333, 3333])
  })
})
