import { describe, expect, it } from 'vitest'
import { dateLabel, relativeTime, todayIso, won } from './format'

describe('format', () => {
  it('won: 천 단위 구분', () => {
    expect(won(0)).toBe('₩0')
    expect(won(360000)).toBe('₩360,000')
    expect(won(1234.6)).toBe('₩1,235')
  })

  it('dateLabel: 월/일', () => {
    expect(dateLabel('2026-10-12')).toBe('10월 12일')
    expect(dateLabel('2026-01-05')).toBe('1월 5일')
  })

  it('todayIso: 로컬 날짜를 0 패딩해서', () => {
    expect(todayIso(new Date(2026, 8, 5))).toBe('2026-09-05')
  })

  it('relativeTime', () => {
    const now = new Date('2026-09-20T12:00:00Z').getTime()
    const ago = (ms: number) => new Date(now - ms).toISOString()
    expect(relativeTime(ago(10_000), now)).toBe('방금')
    expect(relativeTime(ago(5 * 60_000), now)).toBe('5분 전')
    expect(relativeTime(ago(3 * 3_600_000), now)).toBe('3시간 전')
    expect(relativeTime(ago(2 * 86_400_000), now)).toBe('2일 전')
    expect(relativeTime('2026-08-01T00:00:00Z', now)).toMatch(/^\d+월 \d+일$/)
  })
})
