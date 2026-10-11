import styles from './AccountPromoCard.module.css'

interface Props {
  onLogin: () => void
  onSignup: () => void
}

/**
 * 로그인하지 않은 사람에게 로그인 / 회원가입을 권하는 카드.
 * 초대코드 참여의 "나 고르기"(07)와 게스트로 들어간 그룹 화면(08~10)에서 같은 모양으로 쓴다.
 */
export default function AccountPromoCard({ onLogin, onSignup }: Props) {
  return (
    <section className={styles.card} aria-label="로그인 / 회원가입 안내">
      <span className={styles.icon} aria-hidden="true">
        <svg viewBox="0 0 48 48" width="48" height="48">
          <circle cx="24" cy="24" r="24" className={styles.iconBg} />
          <circle cx="22" cy="18" r="6.5" className={styles.person} />
          <path d="M10.5 35c0-6.6 5.1-11 11.5-11s11.5 4.4 11.5 11z" className={styles.person} />
          <circle cx="33" cy="33" r="7" className={styles.badge} />
          <path d="M33 29.5v7M29.5 33h7" className={styles.badgePlus} />
        </svg>
      </span>
      <div className={styles.text}>
        <p className={styles.title}>계정으로 더 편리하게 이용하세요</p>
        <p className={styles.sub}>기존 계정으로 로그인하거나 새로 가입해 보세요.</p>
      </div>
      <div className={styles.actions}>
        <button type="button" className={`${styles.button} ${styles.login}`} onClick={onLogin}>
          로그인
        </button>
        <button type="button" className={`${styles.button} ${styles.signup}`} onClick={onSignup}>
          회원가입
        </button>
      </div>
    </section>
  )
}
