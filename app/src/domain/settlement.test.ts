import { describe, expect, it } from 'vitest'
import {
  computeBalances,
  computeShares,
  computeTransfers,
  groupTotal,
  splitByRatio,
  splitEqual,
  totalsByCategory,
} from './settlement'
import type { ExpenseWithParticipants, SplitType } from './types'

const sum = (shares: Record<string, number>) => Object.values(shares).reduce((a, b) => a + b, 0)

type ExpenseInput = Partial<Omit<ExpenseWithParticipants, 'participants'>> & {
  paidBy: string
  amount: number
  /** [memberId, shareAmount] */
  participants: [string, number | null][]
}

function expense(input: ExpenseInput): ExpenseWithParticipants {
  const { participants, ...rest } = input
  return {
    id: 'e1',
    groupId: 'g1',
    title: '테스트',
    category: '식비',
    receiptImageUrl: null,
    splitType: 'equal' as SplitType,
    spentAt: '2026-09-20',
    createdAt: '2026-09-20T00:00:00.000Z',
    ...rest,
    participants: participants.map(([memberId, shareAmount]) => ({
      expenseId: 'e1',
      memberId,
      shareAmount,
    })),
  }
}

describe('splitEqual', () => {
  it('나누어떨어지면 전원 같은 금액', () => {
    expect(splitEqual(9000, ['a', 'b', 'c'])).toEqual({ a: 3000, b: 3000, c: 3000 })
  })

  it('나머지 1원은 memberId 오름차순 앞사람에게 (입력 순서와 무관)', () => {
    expect(splitEqual(10000, ['c', 'a', 'b'])).toEqual({ a: 3334, b: 3333, c: 3333 })
  })

  it('나머지가 여러 원이면 앞에서부터 1원씩', () => {
    // 10원 / 4명 → base 2, remainder 2
    expect(splitEqual(10, ['d', 'c', 'b', 'a'])).toEqual({ a: 3, b: 3, c: 2, d: 2 })
  })

  it('합계는 항상 원래 금액', () => {
    for (const amount of [1, 7, 100, 9999, 10001]) {
      for (const n of [1, 2, 3, 7, 15]) {
        const ids = Array.from({ length: n }, (_, i) => `m${i}`)
        expect(sum(splitEqual(amount, ids))).toBe(amount)
      }
    }
  })

  it('참여자가 없으면 빈 객체', () => {
    expect(splitEqual(1000, [])).toEqual({})
  })
})

describe('splitByRatio', () => {
  it('비율을 원으로 환산', () => {
    expect(splitByRatio(10000, { a: 50, b: 30, c: 20 })).toEqual({ a: 5000, b: 3000, c: 2000 })
  })

  it('내림 후 남는 오차를 memberId 오름차순으로 1원씩 분배해 합계를 맞춘다', () => {
    // 100원을 33/33/34% → 33+33+34 = 100 (오차 없음)
    expect(sum(splitByRatio(100, { a: 33, b: 33, c: 34 }))).toBe(100)
    // 1000원 33.3/33.3/33.4% → 333+333+334 = 1000
    const shares = splitByRatio(1000, { a: 33.3, b: 33.3, c: 33.4 })
    expect(shares).toEqual({ a: 333, b: 333, c: 334 })
    // 101원 50/50% → 50+50, 오차 1원은 a
    expect(splitByRatio(101, { b: 50, a: 50 })).toEqual({ a: 51, b: 50 })
  })

  it('소수 %의 부동소수 오차로 1원이 모자라게 내림되지 않는다', () => {
    // 1000 * 32.3 / 100 은 JS에서 322.99999999999994 → 보정 없이 내림하면 322원이 됨
    expect(splitByRatio(1000, { a: 32.3, b: 67.7 })).toEqual({ a: 323, b: 677 })
    expect(splitByRatio(50000, { a: 2.3, b: 97.7 })).toEqual({ a: 1150, b: 48850 })
  })
})

describe('computeShares', () => {
  it('equal은 저장값 없이 매번 계산', () => {
    const e = expense({
      paidBy: 'a',
      amount: 10000,
      participants: [
        ['a', null],
        ['b', null],
        ['c', null],
      ],
    })
    expect(computeShares(e)).toEqual({ a: 3334, b: 3333, c: 3333 })
  })

  it('ratio/amount는 확정 저장된 shareAmount를 그대로 사용', () => {
    const e = expense({
      paidBy: 'a',
      amount: 10000,
      splitType: 'amount',
      participants: [
        ['a', 7000],
        ['b', 3000],
      ],
    })
    expect(computeShares(e)).toEqual({ a: 7000, b: 3000 })
  })
})

describe('computeBalances', () => {
  it('결제 합 / 부담 합 / 잔액', () => {
    // a가 9000원 결제, a·b·c 균등 / b가 3000원 결제, b·c만 참여
    const expenses = [
      expense({
        id: 'e1',
        paidBy: 'a',
        amount: 9000,
        participants: [
          ['a', null],
          ['b', null],
          ['c', null],
        ],
      }),
      expense({
        id: 'e2',
        paidBy: 'b',
        amount: 3000,
        participants: [
          ['b', null],
          ['c', null],
        ],
      }),
    ]
    const { paid, owed, balance } = computeBalances(['a', 'b', 'c'], expenses)
    expect(paid).toEqual({ a: 9000, b: 3000, c: 0 })
    expect(owed).toEqual({ a: 3000, b: 4500, c: 4500 })
    expect(balance).toEqual({ a: 6000, b: -1500, c: -4500 })
  })

  it('잔액 합계는 항상 0 (나머지 배분 포함)', () => {
    const expenses = [
      expense({
        paidBy: 'a',
        amount: 10000,
        participants: [
          ['a', null],
          ['b', null],
          ['c', null],
        ],
      }),
    ]
    const { balance } = computeBalances(['a', 'b', 'c'], expenses)
    expect(sum(balance)).toBe(0)
  })

  it('결제자가 참여자에 없으면 전액을 돌려받는다', () => {
    const expenses = [
      expense({
        paidBy: 'a',
        amount: 6000,
        participants: [
          ['b', null],
          ['c', null],
        ],
      }),
    ]
    const { balance } = computeBalances(['a', 'b', 'c'], expenses)
    expect(balance).toEqual({ a: 6000, b: -3000, c: -3000 })
  })

  it('지출이 없으면 전원 0', () => {
    expect(computeBalances(['a', 'b'], []).balance).toEqual({ a: 0, b: 0 })
  })
})

describe('computeTransfers', () => {
  it('가장 큰 채권자·채무자부터 매칭', () => {
    expect(computeTransfers({ a: 6000, b: -1500, c: -4500 })).toEqual([
      { from: 'c', to: 'a', amount: 4500 },
      { from: 'b', to: 'a', amount: 1500 },
    ])
  })

  it('A→B, B→C 같은 중복 송금을 줄인다', () => {
    // a는 b에게 1000, b는 c에게 1000 보낼 관계 → b 잔액 0 → a가 c에게 직접
    expect(computeTransfers({ a: -1000, b: 0, c: 1000 })).toEqual([
      { from: 'a', to: 'c', amount: 1000 },
    ])
  })

  it('잔액 0인 멤버는 결과에 나오지 않는다', () => {
    const transfers = computeTransfers({ a: 500, b: -500, c: 0 })
    expect(transfers).toEqual([{ from: 'b', to: 'a', amount: 500 }])
  })

  it('한 명이 여러 명에게 나눠 보낼 수 있다', () => {
    expect(computeTransfers({ a: 3000, b: 2000, c: -5000 })).toEqual([
      { from: 'c', to: 'a', amount: 3000 },
      { from: 'c', to: 'b', amount: 2000 },
    ])
  })

  it('금액이 같으면 memberId 오름차순으로 결정적', () => {
    expect(computeTransfers({ b: 1000, a: 1000, d: -1000, c: -1000 })).toEqual([
      { from: 'c', to: 'a', amount: 1000 },
      { from: 'd', to: 'b', amount: 1000 },
    ])
  })

  it('송금을 모두 실행하면 전원 잔액이 0이 된다', () => {
    const balance = { a: 7300, b: -1200, c: -2100, d: 500, e: -4500 }
    const settled = { ...balance }
    for (const t of computeTransfers(balance)) {
      settled[t.from as keyof typeof settled] += t.amount
      settled[t.to as keyof typeof settled] -= t.amount
    }
    expect(Object.values(settled).every((v) => v === 0)).toBe(true)
  })

  it('모두 0이면 송금 없음', () => {
    expect(computeTransfers({ a: 0, b: 0 })).toEqual([])
  })
})

describe('집계', () => {
  const expenses = [
    expense({ id: 'e1', paidBy: 'a', amount: 9000, category: '식비', participants: [['a', null]] }),
    expense({ id: 'e2', paidBy: 'a', amount: 3000, category: '교통', participants: [['a', null]] }),
    expense({ id: 'e3', paidBy: 'b', amount: 1000, category: '식비', participants: [['a', null]] }),
  ]

  it('그룹 총액', () => {
    expect(groupTotal(expenses)).toBe(13000)
    expect(groupTotal([])).toBe(0)
  })

  it('카테고리별 합계 — 없는 카테고리도 0으로 포함', () => {
    expect(totalsByCategory(expenses)).toEqual({
      숙소: 0,
      식비: 10000,
      교통: 3000,
      액티비티: 0,
      쇼핑: 0,
      기타: 0,
    })
  })
})
