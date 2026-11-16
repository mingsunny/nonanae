import { FEEDBACK_FORM_URL } from '../../domain/feedback'
import { paths } from '../../routes/paths'

/** 개인정보 처리방침 링크. 입력 중이던 화면이 사라지지 않도록 새 탭으로 연다. */
export default function PrivacyLink({ className, children }: { className?: string; children?: string }) {
  return (
    <a href={paths.privacy} target="_blank" rel="noopener noreferrer" className={className}>
      {children ?? '개인정보 처리방침'}
    </a>
  )
}

/** 이용약관 링크. PrivacyLink와 같이 새 탭으로 연다. */
export function TermsLink({ className, children }: { className?: string; children?: string }) {
  return (
    <a href={paths.terms} target="_blank" rel="noopener noreferrer" className={className}>
      {children ?? '이용약관'}
    </a>
  )
}

/** 베타 테스터 의견 보내기(구글폼) 링크. 폼 주소가 아직 없으면 아무것도 그리지 않는다. 앞에 붙일 구분자(' · ')도 함께 받는다 */
export function FeedbackLink({ className, separator = '' }: { className?: string; separator?: string }) {
  if (!FEEDBACK_FORM_URL) return null
  return (
    <>
      <a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer" className={className}>
        의견 보내기
      </a>
      {separator}
    </>
  )
}
