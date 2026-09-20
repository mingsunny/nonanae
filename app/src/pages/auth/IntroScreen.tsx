import Button from '../../components/common/Button'
import fields from '../../components/common/Field.module.css'
import logoUrl from '../../assets/logo.png'
import styles from './auth.module.css'

interface Props {
  onLogin: () => void
  onSignup: () => void
  onJoin: () => void
}

/** 01 인트로 — 앱을 열면 가장 먼저 보이는 화면. 로그인 / 회원가입 / 초대코드 참여로 갈라진다. */
export default function IntroScreen({ onLogin, onSignup, onJoin }: Props) {
  return (
    <div className={styles.intro}>
      <div className={styles.hero}>
        <h1 className={styles.logo}>
          <img src={logoUrl} alt="노나내" />
        </h1>
        <p className={styles.tagline}>
          여행에서 함께 쓴 돈,
          <br />
          가장 간단하게 나눠 정산해요.
        </p>
      </div>
      <div className={styles.actions}>
        <Button onClick={onLogin}>로그인</Button>
        <div className={styles.actionGap}>
          <Button variant="outline" onClick={onSignup}>
            회원가입
          </Button>
        </div>
        {/* 문구는 "가입"이지만 실제로는 가입 없이 참여하는 경로다 (01 UI 구성요소: 문구 정리 필요 항목) */}
        <div className={styles.joinLink}>
          <button type="button" className={fields.textLink} onClick={onJoin}>
            초대코드로 가입하기
          </button>
        </div>
      </div>
    </div>
  )
}
