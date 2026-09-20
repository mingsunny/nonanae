// 지출 폼(11)의 나누기 방식 계산. 화면과 분리한 순수 함수.
import { splitByRatio, splitEqual } from './settlement'
import type { AmountByMember, ExpenseWithParticipants, SplitType } from './types'

/** 비율(%) 합계 비교 시 소수 오차 허용치 */
const EPSILON = 1e-6

/**
 * 비율/금액 모드로 전환하거나 참여자가 바뀔 때 채워주는 값(균등 배분).
 * 비율은 100%, 금액은 총액을 참여자 수로 나눈다. (11 §3.2 prefill)
 */
export function prefillShares(
  mode: 'ratio' | 'amount',
  amount: number,
  memberIds: string[],
): AmountByMember {
  return splitEqual(mode === 'ratio' ? 100 : amount, memberIds)
}

export interface SplitCheck {
  sum: number
  /** 비율=100, 금액=총액 */
  target: number
  ok: boolean
}

/** 비율/금액 모드의 합계가 목표값과 일치하는지. 균등은 항상 ok. */
export function checkSplit(
  mode: SplitType,
  amount: number,
  memberIds: string[],
  customShares: AmountByMember,
): SplitCheck {
  if (mode === 'equal') return { sum: amount, target: amount, ok: true }
  const sum = memberIds.reduce((s, id) => s + (customShares[id] ?? 0), 0)
  const target = mode === 'ratio' ? 100 : amount
  return { sum, target, ok: Math.abs(sum - target) < EPSILON }
}

/**
 * 폼 입력을 저장할 참여자 행으로 확정. equal은 매번 계산하므로 null,
 * amount는 입력값 그대로, ratio는 % → 원 환산 후 오차를 분배해 합계를 맞춘다.
 */
export function finalizeParticipants(
  mode: SplitType,
  amount: number,
  memberIds: string[],
  customShares: AmountByMember,
): { memberId: string; shareAmount: number | null }[] {
  if (mode === 'equal') return memberIds.map((memberId) => ({ memberId, shareAmount: null }))
  if (mode === 'amount') {
    return memberIds.map((memberId) => ({
      memberId,
      shareAmount: Math.round(customShares[memberId] ?? 0),
    }))
  }
  const percents: AmountByMember = {}
  for (const id of memberIds) percents[id] = customShares[id] ?? 0
  const shares = splitByRatio(amount, percents)
  return memberIds.map((memberId) => ({ memberId, shareAmount: shares[memberId] }))
}

/** 수정 모드에서 기존 지출을 폼 입력값(customShares)으로 되돌림. ratio는 저장된 원 → % (소수 둘째 자리). */
export function customSharesFromExpense(expense: ExpenseWithParticipants): AmountByMember {
  const shares: AmountByMember = {}
  if (expense.splitType === 'equal') return shares
  for (const p of expense.participants) {
    const won = p.shareAmount ?? 0
    shares[p.memberId] =
      expense.splitType === 'ratio' ? Math.round((won / expense.amount) * 10000) / 100 : won
  }
  return shares
}
