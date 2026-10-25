import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { resendSignupEmail } from '../../api'
import Button from '../../components/common/Button'
import Callout from '../../components/common/Callout'
import fields from '../../components/common/Field.module.css'
import Topbar from '../../components/common/Topbar'
import { usePrefetchCaptcha } from '../../lib/captcha'
import { paths } from '../../routes/paths'
import { showToast } from '../../store/toastStore'
import { useAuthFlowStore } from '../../store/authFlowStore'
import styles from './auth.module.css'

/** 확인 메일을 다시 보낼 수 있게 되기까지 기다리는 시간 (연타로 발송 한도를 쓰지 않도록) */
const RESEND_COOLDOWN_SECONDS = 60

/**
 * 01 이메일 확인 안내 (`/signup/confirm`). 회원가입 1단계에서 확인 메일을 보낸 뒤 보여준다.
 * 메일의 링크를 누르면 로그인된 채로 계좌 등록(`/signup/account`)으로 돌아온다 — 이 화면은 그때까지의 대기 화면이다.
 * 입력했던 이메일은 1단계 입력값(draft)에서 가져온다. 새로고침 등으로 없어졌다면 1단계로 돌려보낸다.
 * 계정은 이미 만들어졌으므로 이메일을 고치러 1단계로 돌아가는 길은 두지 않는다 — 뒤로가기는 1단계가 아니라 처음 온 곳(인트로 또는 초대 화면)으로 간다.
 */
export default function CheckEmailScreen() {
  const navigate = useNavigate()
  const email = useAuthFlowStore((s) => s.draft.email)
  const returnTo = useAuthFlowStore((s) => s.returnTo)
  const [seconds, setSeconds] = useState(RESEND_COOLDOWN_SECONDS)
  const [busy, setBusy] = useState(false)
  // 메일 다시 보내기도 봇 확인을 거친다
  usePrefetchCaptcha()

  useEffect(() => {
    if (seconds <= 0) return
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [seconds])

  if (email.trim() === '') return <Navigate to={paths.signup} replace />

  async function resend() {
    if (busy || seconds > 0) return
    setBusy(true)
    try {
      await resendSignupEmail(email, returnTo ?? undefined)
      showToast('확인 메일을 다시 보냈어요')
      setSeconds(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '메일을 다시 보내지 못했어요')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Topbar title="이메일 확인" onBack={() => navigate(returnTo ?? paths.welcome, { replace: true })} />
      <div className={styles.body}>
        <Callout>
          <span className={styles.confirmEmail}>{email}</span>
          <br />
          으로 확인 메일을 보냈어요. 메일의 링크를 누르면
          <br />
          이름과 계좌를 등록하고 가입이 끝나요.
        </Callout>
        <p className={styles.stepHint}>메일이 안 보이면 스팸함도 확인해주세요.</p>
        <div className={styles.confirmActions}>
          <Button variant="outline" onClick={resend} disabled={busy || seconds > 0}>
            {seconds > 0 ? `메일 다시 보내기 (${seconds}초)` : '메일 다시 보내기'}
          </Button>
        </div>
        <div className={styles.confirmLinks}>
          <button type="button" className={fields.textLink} onClick={() => navigate(paths.login)}>
            로그인
          </button>
        </div>
      </div>
    </div>
  )
}
