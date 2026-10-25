import { Link } from 'react-router-dom'
import Topbar from '../components/common/Topbar'
import type { PolicySection } from '../domain/privacyPolicy'
import { PRIVACY_EFFECTIVE_DATE, PRIVACY_SECTIONS } from '../domain/privacyPolicy'
import { TERMS_EFFECTIVE_DATE, TERMS_SECTIONS } from '../domain/termsOfService'
import { paths } from '../routes/paths'
import styles from './PolicyPage.module.css'

/**
 * 개인정보 처리방침(`/privacy`)과 이용약관(`/terms`). 로그인 없이 누구나 볼 수 있다.
 * 가입·참여 화면에서는 입력하던 내용이 사라지지 않도록 새 탭으로 열기 때문에, 뒤로가기 대신 앱으로 가는 링크를 둔다.
 */
function PolicyPage({ title, effectiveDate, sections }: { title: string; effectiveDate: string; sections: PolicySection[] }) {
  return (
    <div>
      <Topbar title={title} />
      <div className={styles.body}>
        <p className={styles.date}>시행일 {effectiveDate}</p>
        {sections.map((section) => (
          <section key={section.title} className={styles.section}>
            <h2 className={styles.heading}>{section.title}</h2>
            {section.paragraphs?.map((p) => (
              <p key={p} className={styles.text}>
                {p}
              </p>
            ))}
            {section.items && (
              <ul className={styles.list}>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
        <p className={styles.home}>
          <Link to={paths.groups}>노나내로 돌아가기</Link>
        </p>
      </div>
    </div>
  )
}

export function PrivacyPage() {
  return <PolicyPage title="개인정보 처리방침" effectiveDate={PRIVACY_EFFECTIVE_DATE} sections={PRIVACY_SECTIONS} />
}

export function TermsPage() {
  return <PolicyPage title="이용약관" effectiveDate={TERMS_EFFECTIVE_DATE} sections={TERMS_SECTIONS} />
}
