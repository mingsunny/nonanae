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
