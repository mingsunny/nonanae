import { describe, expect, it } from 'vitest'
import { formatMoney, parseMoneyInput, toCurrency, toMoneyInput } from './currency'

describe('formatMoney', () => {
  it('KRW는 원 단위 정수를 ₩와 쉼표로', () => {
    expect(formatMoney(30000, 'KRW')).toBe('₩30,000')
    expect(formatMoney(0, 'KRW')).toBe('₩0')
  })

  it('USD는 센트 정수를 $와 소수 둘째 자리까지', () => {
    expect(formatMoney(123456, 'USD')).toBe('$1,234.56')
    expect(formatMoney(1200, 'USD')).toBe('$12.00')
    expect(formatMoney(5, 'USD')).toBe('$0.05')
  })
})

describe('parseMoneyInput / toMoneyInput', () => {
  it('KRW는 입력 그대로 정수', () => {
    expect(parseMoneyInput('12000', 'KRW')).toBe(12000)
    expect(toMoneyInput(12000, 'KRW')).toBe('12000')
  })

  it('USD는 달러 입력을 센트로, 센트를 달러 입력으로', () => {
    expect(parseMoneyInput('12.34', 'USD')).toBe(1234)
    expect(parseMoneyInput('12', 'USD')).toBe(1200)
    expect(parseMoneyInput('0.1', 'USD')).toBe(10)
    // 부동소수 오차가 있어도 센트로 반올림
    expect(parseMoneyInput('19.99', 'USD')).toBe(1999)
    expect(parseMoneyInput('1.005', 'USD')).toBe(101)
    expect(toMoneyInput(1234, 'USD')).toBe('12.34')
    expect(toMoneyInput(1200, 'USD')).toBe('12')
  })

  it('비어 있거나 숫자가 아니거나 음수면 0', () => {
    expect(parseMoneyInput('', 'USD')).toBe(0)
    expect(parseMoneyInput('abc', 'KRW')).toBe(0)
    expect(parseMoneyInput('-5', 'KRW')).toBe(0)
  })
})

describe('toCurrency', () => {
  it('모르는 값·빈 값은 KRW (통화 컬럼이 생기기 전 데이터)', () => {
    expect(toCurrency('USD')).toBe('USD')
    expect(toCurrency('KRW')).toBe('KRW')
    expect(toCurrency(undefined)).toBe('KRW')
    expect(toCurrency('EUR')).toBe('KRW')
  })
})
