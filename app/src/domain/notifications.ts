// 알림 문구. 출처: docs/spec/13-notifications.md. 알림 문구는 만들 때 이름을 채워 고정 저장한다(이후 이름이 바뀌어도 그대로).

/**
 * 지출 등록 알림 문구. 등록한 사람이 아니라 **결제자** 이름을 쓴다 — 지출에 "등록한 사람" 필드가 없고
 * 다른 사람 대신 등록할 수도 있어서, "OO님이 추가했어요"라고 쓰면 오해를 준다 (13 알림1).
 */
export function expenseAddedTitle(groupName: string, payerName: string): string {
  return `[${groupName}]에 ${payerName || '누군가'}님이 결제한 내역이 추가됐어요`
}
