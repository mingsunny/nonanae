// 정산 계산. 출처: docs/spec/schema.md "계산 로직". 순수 함수만 두고 화면/상태 코드는 import하지 않는다.
// 모든 금액은 원 단위 정수. 나머지(잔돈) 배분 순서는 memberId 오름차순으로 고정 — 같은 입력이면 항상 같은 결과.
import { CATEGORIES } from './types'
import type {
  AmountByMember,
  Category,
  ExpenseWithParticipants,
  Transfer,
} from './types'

const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/**
 * 남는 금액(remainder)을 memberId 오름차순으로 1원씩 나눠 shares에 더한다.
 * 참여자 수보다 remainder가 크면 처음부터 다시 돈다.
 */
function distributeRemainder(shares: AmountByMember, remainder: number): void {
  const order = Object.keys(shares).sort(byId)
  for (let i = 0; remainder > 0 && order.length > 0; i++, remainder--) {
    shares[order[i % order.length]] += 1
  }
}

/** 균등: base = floor(amount / N), 나머지는 참여자 전체를 memberId 오름차순으로 앞에서부터 1원씩. */
export function splitEqual(amount: number, memberIds: string[]): AmountByMember {
  const shares: AmountByMember = {}
  if (memberIds.length === 0) return shares
  const base = Math.floor(amount / memberIds.length)
  for (const id of memberIds) shares[id] = base
  distributeRemainder(shares, amount - base * memberIds.length)
  return shares
}

/**
 * 비율: 입력한 %를 원 단위로 환산(내림)하고, 남는 오차를 memberId 오름차순으로 1원씩 분배.
 * 합계가 100%인 입력을 전제로 한다(검증은 폼 쪽 책임).
 */
export function splitByRatio(amount: number, percents: AmountByMember): AmountByMember {
  const shares: AmountByMember = {}
  let allocated = 0
  for (const [id, percent] of Object.entries(percents)) {
    // 33.3 같은 소수 % 입력에서 부동소수 오차로 1원 모자라게 내림되는 것을 막는 보정값
    const won = Math.floor((amount * percent) / 100 + 1e-9)
    shares[id] = won
    allocated += won
  }
  distributeRemainder(shares, amount - allocated)
  return shares
}

/**
 * 지출 1건의 참여자별 분담액.
 * equal은 저장하지 않으므로 매번 계산하고, ratio/amount는 등록 시점에 확정 저장된 shareAmount를 그대로 쓴다.
 */
export function computeShares(expense: ExpenseWithParticipants): AmountByMember {
  if (expense.splitType === 'equal') {
    return splitEqual(
      expense.amount,
      expense.participants.map((p) => p.memberId),
    )
  }
  const shares: AmountByMember = {}
  for (const p of expense.participants) shares[p.memberId] = p.shareAmount ?? 0
  return shares
}

export interface MemberBalances {
  /** 결제 합: 그 사람이 paidBy인 지출의 amount 합 ("각자 얼마 결제했는지") */
  paid: AmountByMember
  /** 부담 합: 참여자로 지정된 지출들의 분담액 합 ("각자 여행에서 쓴 금액") */
  owed: AmountByMember
  /** paid - owed. 양수면 받을 돈, 음수면 보낼 돈 */
  balance: AmountByMember
}

export function computeBalances(
  memberIds: string[],
  expenses: ExpenseWithParticipants[],
): MemberBalances {
  const paid: AmountByMember = {}
  const owed: AmountByMember = {}
  for (const id of memberIds) {
    paid[id] = 0
    owed[id] = 0
  }
  for (const expense of expenses) {
    paid[expense.paidBy] = (paid[expense.paidBy] ?? 0) + expense.amount
    for (const [id, share] of Object.entries(computeShares(expense))) {
      owed[id] = (owed[id] ?? 0) + share
    }
  }
  const balance: AmountByMember = {}
  for (const id of new Set([...Object.keys(paid), ...Object.keys(owed)])) {
    balance[id] = (paid[id] ?? 0) - (owed[id] ?? 0)
  }
  return { paid, owed, balance }
}

/**
 * 최소 송금: 가장 큰 채권자와 가장 큰 채무자를 골라 min(채권, 채무)만큼 송금 관계를 만들고, 한쪽이 0이 될 때까지 반복.
 * 금액이 같을 땐 memberId 오름차순. 진짜 최소 건수를 보장하진 않는 그리디 방식(schema.md).
 * 잔액이 0인 멤버는 결과에 나오지 않는다.
 */
export function computeTransfers(balance: AmountByMember): Transfer[] {
  const creditors = Object.entries(balance)
    .filter(([, v]) => v > 0)
    .map(([id, amount]) => ({ id, amount }))
  const debtors = Object.entries(balance)
    .filter(([, v]) => v < 0)
    .map(([id, v]) => ({ id, amount: -v }))
  const largestFirst = (a: { id: string; amount: number }, b: { id: string; amount: number }) =>
    b.amount - a.amount || byId(a.id, b.id)

  const transfers: Transfer[] = []
  while (creditors.length > 0 && debtors.length > 0) {
    creditors.sort(largestFirst)
    debtors.sort(largestFirst)
    const creditor = creditors[0]
    const debtor = debtors[0]
    const amount = Math.min(creditor.amount, debtor.amount)
    transfers.push({ from: debtor.id, to: creditor.id, amount })
    creditor.amount -= amount
    debtor.amount -= amount
    if (creditor.amount === 0) creditors.shift()
    if (debtor.amount === 0) debtors.shift()
  }
  return transfers
}

/** 그룹 총 사용 금액 (08 헤더 등) */
export function groupTotal(expenses: ExpenseWithParticipants[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0)
}

/** 카테고리별 합계 (10 요약). 지출이 없는 카테고리도 0으로 포함. */
export function totalsByCategory(expenses: ExpenseWithParticipants[]): Record<Category, number> {
  const totals = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>
  for (const e of expenses) totals[e.category] += e.amount
  return totals
}
