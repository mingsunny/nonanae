/**
 * 그룹 통화. 그룹마다 하나를 고르고, 그 그룹의 모든 금액이 그 통화다.
 * 금액은 DB·계산 모두 **가장 작은 단위의 정수**로 다룬다 — KRW는 원, USD는 센트($12.34 → 1234).
 * 그래서 나누기·정산 계산(settlement.ts)은 통화와 상관없이 그대로 쓰고, 보여 줄 때와 입력받을 때만 바꾼다.
 */
export type Currency = 'KRW' | 'USD'

export const CURRENCIES: Currency[] = ['KRW', 'USD']
export const DEFAULT_CURRENCY: Currency = 'KRW'

/** 소수 자릿수 (USD 센트 = 2) */
const DECIMALS: Record<Currency, number> = { KRW: 0, USD: 2 }
const SYMBOL: Record<Currency, string> = { KRW: '₩', USD: '$' }
/** 금액 입력칸 옆에 붙는 단위 */
export const UNIT_LABEL: Record<Currency, string> = { KRW: '원', USD: '$' }

/** DB·옛 데이터에서 읽은 값을 통화로. 모르는 값이나 비어 있으면 KRW */
export function toCurrency(value: unknown): Currency {
  return value === 'USD' ? 'USD' : 'KRW'
}

/** 최소 단위 정수 → 표시: ₩12,000 / $12.34 */
export function formatMoney(minor: number, currency: Currency): string {
  const decimals = DECIMALS[currency]
  const value = Math.round(minor) / 10 ** decimals
  const sign = value < 0 ? '-' : ''
  const text = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${sign}${SYMBOL[currency]}${text}`
}

/**
 * 입력칸 글자 → 최소 단위 정수. "12.345"처럼 자릿수를 넘으면 반올림, 숫자가 아니면(음수 포함) 0.
 * 부동소수 곱셈(1.005 * 100 = 100.4999…) 오차를 피하려고 글자 그대로 자릿수를 옮긴다.
 */
export function parseMoneyInput(text: string, currency: Currency): number {
  const match = text.trim().match(/^(\d*)(?:\.(\d*))?$/)
  if (!match || (match[1] === '' && !match[2])) return 0
  const decimals = DECIMALS[currency]
  const fraction = match[2] ?? ''
  const kept = fraction.slice(0, decimals).padEnd(decimals, '0')
  const minor = Number(match[1] || '0') * 10 ** decimals + Number(kept || '0')
  return Number(fraction[decimals] ?? '0') >= 5 ? minor + 1 : minor
}

/** 최소 단위 정수 → 입력칸에 채울 글자 (USD 1234 → "12.34", 1200 → "12") */
export function toMoneyInput(minor: number, currency: Currency): string {
  const decimals = DECIMALS[currency]
  if (decimals === 0) return String(Math.round(minor))
  return String(Math.round(minor) / 10 ** decimals)
}

/** 소수 입력이 필요한 통화인지 (입력칸 키보드 모양) */
export function allowsDecimals(currency: Currency): boolean {
  return DECIMALS[currency] > 0
}
