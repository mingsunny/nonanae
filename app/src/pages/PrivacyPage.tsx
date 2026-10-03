import { Link } from 'react-router-dom'
import Topbar from '../components/common/Topbar'
import { PRIVACY_EFFECTIVE_DATE, PRIVACY_SECTIONS } from '../domain/privacyPolicy'
import { paths } from '../routes/paths'
import styles from './PrivacyPage.module.css'

/**
 * 개인정보 처리방침(`/privacy`). 로그인 없이 누구나 볼 수 있다.
 * 가입·참여 화면에서는 입력하던 내용이 사라지지 않도록 새 탭으로 열기 때문에, 뒤로가기 대신 앱으로 가는 링크를 둔다.
 */
export default function PrivacyPage() {
  return (
    <div>
      <Topbar title="개인정보 처리방침" />
      <div className={styles.body}>
        <p className={styles.date}>시행일 {PRIVACY_EFFECTIVE_DATE}</p>
        {PRIVACY_SECTIONS.map((section) => (
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
