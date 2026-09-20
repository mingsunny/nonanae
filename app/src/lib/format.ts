/** 금액 표시: ₩12,000 */
export function won(amount: number): string {
  return `₩${Math.round(amount).toLocaleString('ko-KR')}`
}

/** 'YYYY-MM-DD' → "10월 12일" */
export function dateLabel(iso: string): string {
  const [, month, day] = iso.split('-').map(Number)
  return `${month}월 ${day}일`
}

/** 오늘 날짜 'YYYY-MM-DD' (로컬 시간 기준) */
export function todayIso(now: Date = new Date()): string {
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${mm}-${dd}`
}

/** 알림 시간 라벨: 방금 / N분 전 / N시간 전 / N일 전 / 그 이후엔 "10월 12일" */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = now - new Date(iso).getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return '방금'
  if (diff < hour) return `${Math.floor(diff / minute)}분 전`
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`
  if (diff < 7 * day) return `${Math.floor(diff / day)}일 전`
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}
