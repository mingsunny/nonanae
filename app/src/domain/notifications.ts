// 알림 문구. 출처: docs/spec/13-notifications.md. 알림 문구는 만들 때 이름을 채워 고정 저장한다(이후 이름이 바뀌어도 그대로).

/**
 * 지출 등록 알림 문구. 등록한 사람이 아니라 **결제자** 이름을 쓴다 — 지출에 "등록한 사람" 필드가 없고
 * 다른 사람 대신 등록할 수도 있어서, "OO님이 추가했어요"라고 쓰면 오해를 준다 (13 알림1).
 */
export function expenseAddedTitle(groupName: string, payerName: string): string {
  return `[${groupName}]에 ${payerName || '누군가'}님이 결제한 내역이 추가됐어요`
}

const ITEM_TITLE_MAX = 30

/**
 * 지출 삭제 알림 문구. 누가 무엇을 지웠는지(항목·금액·결제자)를 남긴다 — 남이 등록한 지출도 지울 수 있기 때문.
 * DB 트리거(`notify_expense_deleted`)가 만드는 문구와 같아야 한다. 항목명은 사용자 입력이라 길면 줄인다.
 */
export function expenseDeletedTitle(input: {
  groupName: string
  itemTitle: string
  amount: number
  payerName: string
  deleterName: string
}): string {
  const chars = Array.from(input.itemTitle)
  const item = chars.length > ITEM_TITLE_MAX ? `${chars.slice(0, ITEM_TITLE_MAX).join('')}…` : input.itemTitle
  const amount = Math.round(input.amount).toLocaleString('en-US')
  return `[${input.groupName}]에서 '${item}' 내역(₩${amount}, 결제: ${input.payerName || '알 수 없음'})을 ${input.deleterName || '누군가'}님이 삭제했어요`
}
