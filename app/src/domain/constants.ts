import type { Category } from './types'

/** 계좌 등록/수정 화면 공통 은행 select 옵션 (docs/spec/conventions.md "은행 목록") */
export const BANKS = [
  '카카오뱅크', '토스뱅크', '케이뱅크', '국민은행', '신한은행', '우리은행', '하나은행',
  '농협은행', '기업은행', 'SC제일은행', '씨티은행', '우체국', '새마을금고', '신협',
  '부산은행', '대구은행', '광주은행', '경남은행',
] as const

/** 카테고리 배지 색상 (프로토타입 CATEGORIES 기준) */
export const CATEGORY_COLORS: Record<Category, string> = {
  숙소: '#4EAD6D',
  식비: '#E3A23C',
  교통: '#5B6B5F',
  액티비티: '#C1443C',
  쇼핑: '#8A6FBF',
  기타: '#9C9686',
}
