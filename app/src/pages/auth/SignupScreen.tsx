import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/common/Button'
import fields from '../../components/common/Field.module.css'
import PasswordInput from '../../components/common/PasswordInput'
import PrivacyLink, { TermsLink } from '../../components/common/PrivacyLink'
import Topbar from '../../components/common/Topbar'
import { isEmailTaken } from '../../api'
import { SignUpConfirmationRequired } from '../../api/errors'
import { PASSWORD_RULE_HINT, passwordProblem } from '../../domain/password'
import { PRIVACY_SUMMARY } from '../../domain/privacyPolicy'
import { prefetchCaptchaToken, usePrefetchCaptcha } from '../../lib/captcha'
import { paths } from '../../routes/paths'
import { useAppStore } from '../../store/appStore'
import { useAuthFlowStore } from '../../store/authFlowStore'
import type { SignupDraft } from '../../store/authFlowStore'
import styles from './auth.module.css'

/**
 * 01 회원가입 1단계 (`/signup`, 이메일 / 비밀번호 / 만 14세 이상·이용약관·개인정보 수집·이용 동의).
 * 동의한 약관·처리방침 버전은 가입 요청에 실려 서버가 동의 시각과 함께 기록한다(user_consents).
 * 순서는 "이메일·비밀번호 → 이메일 확인 → 이름·계좌 등록(02)"이다. 여기서 "다음"을 누르면 이메일·비밀번호로 계정만 만들고
 * 확인 메일을 보낸다(`/signup/confirm`). 메일의 링크를 누르면 로그인된 채로 계좌 등록 화면으로 돌아온다.
 * 이메일 확인이 꺼져 있으면(목업 포함) 바로 계좌 등록으로 넘어간다.
 */
export default function SignupScreen() {
  const navigate = useNavigate()
  const draft = useAuthFlowStore((s) => s.draft)
  const patchDraft = useAuthFlowStore((s) => s.patchDraft)
  const returnTo = useAuthFlowStore((s) => s.returnTo)
  const signUp = useAppStore((s) => s.signUp)
  const [age14, setAge14] = useState(false)
  const [terms, setTerms] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const consent = age14 && terms && privacy

  function agreeAll(checked: boolean) {
    setAge14(checked)
    setTerms(checked)
    setPrivacy(checked)
  }
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  usePrefetchCaptcha()
  // 이메일 중복 확인은 입력칸을 벗어날 때 미리 시작해 두고, "다음"을 누르면 같은 이메일이면 그 결과를 쓴다
  const emailCheck = useRef<{ email: string; taken: Promise<boolean> } | null>(null)

  function checkEmail(email: string): Promise<boolean> {
    const key = email.trim()
    if (emailCheck.current?.email !== key) {
      const taken = isEmailTaken(key)
      // 미리 확인이 실패하면 버리고 제출 때 다시 확인한다
      taken.catch(() => {
        if (emailCheck.current?.taken === taken) emailCheck.current = null
      })
      emailCheck.current = { email: key, taken }
    }
    return emailCheck.current.taken
  }

  const confirmed = draft.passwordConfirm.length > 0
  const matches = draft.password === draft.passwordConfirm
  // 규칙 안내는 입력을 시작한 뒤에만 에러로 보여준다
  const ruleProblem = draft.password.length > 0 ? passwordProblem(draft.password) : null
  const canSubmit =
    draft.email.trim().includes('@') &&
    draft.password.length > 0 &&
    ruleProblem === null &&
    confirmed &&
    matches &&
    consent

  function edit(patch: Partial<SignupDraft>) {
    patchDraft(patch)
    setError(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || busy) return
    setBusy(true)
    try {
      if (await checkEmail(draft.email)) {
        setError('이미 가입된 이메일이에요. 로그인해주세요.')
        return
      }
      await signUp({ email: draft.email, password: draft.password, redirectPath: returnTo ?? undefined })
      // 계정이 만들어졌으니 비밀번호는 메모리에서 비운다 (이메일은 확인 화면에서 쓴다)
      patchDraft({ password: '', passwordConfirm: '' })
      navigate(paths.signupAccount, { replace: true })
    } catch (err) {
      if (err instanceof SignUpConfirmationRequired) {
        patchDraft({ password: '', passwordConfirm: '' })
        navigate(paths.signupConfirm, { replace: true })
        return
      }
      setError(err instanceof Error ? err.message : '가입하지 못했어요')
      // 다시 시도할 때 기다리지 않도록 다음 봇 확인을 바로 받아 둔다
      prefetchCaptchaToken()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Topbar title="회원가입" onBack={() => navigate(returnTo ?? paths.welcome)} />
      <form className={styles.body} onSubmit={submit}>
        <label className={fields.label} htmlFor="signup-email">
          이메일
        </label>
        <input
          id="signup-email"
          className={fields.input}
          type="email"
          autoComplete="email"
          placeholder="예) nonanae@gmail.com"
          value={draft.email}
          onChange={(e) => edit({ email: e.target.value })}
          onBlur={() => {
            if (draft.email.trim().includes('@')) void checkEmail(draft.email).catch(() => {})
          }}
        />
        <label className={fields.label} htmlFor="signup-password">
          비밀번호
        </label>
        <PasswordInput
          id="signup-password"
          autoComplete="new-password"
          placeholder={PASSWORD_RULE_HINT}
          value={draft.password}
          onChange={(e) => edit({ password: e.target.value })}
        />
        {ruleProblem && <p className={fields.error}>{ruleProblem}</p>}
        <label className={fields.label} htmlFor="signup-password-confirm">
          비밀번호 확인
        </label>
        <PasswordInput
          id="signup-password-confirm"
          autoComplete="new-password"
          placeholder="비밀번호를 한 번 더 입력해주세요"
          value={draft.passwordConfirm}
          onChange={(e) => edit({ passwordConfirm: e.target.value })}
        />
        {confirmed && (
          <p className={matches ? fields.ok : fields.error}>
            {matches ? '비밀번호가 일치해요.' : '비밀번호가 일치하지 않아요.'}
          </p>
        )}
        <div className={styles.consent}>
          <label className={`${styles.consentRow} ${styles.consentAll}`}>
            <input type="checkbox" checked={consent} onChange={(e) => agreeAll(e.target.checked)} />
            <span>전체 동의</span>
          </label>
          <label className={styles.consentRow}>
            <input type="checkbox" checked={age14} onChange={(e) => setAge14(e.target.checked)} />
            <span>[필수] 만 14세 이상입니다</span>
          </label>
          <label className={styles.consentRow}>
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            <span>[필수] 이용약관에 동의합니다</span>
          </label>
          <p className={styles.consentDetail}>
            노나내는 정산 금액을 계산해 주는 도구이고, 송금은 이용자끼리 직접 해요.{' '}
            <TermsLink className={styles.consentLink}>전체 보기</TermsLink>
          </p>
          <label className={styles.consentRow}>
            <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />
            <span>[필수] 개인정보 수집·이용에 동의합니다</span>
          </label>
          <p className={styles.consentDetail}>
            수집 항목: {PRIVACY_SUMMARY.items}
            <br />
            이용 목적: {PRIVACY_SUMMARY.purpose}
            <br />
            보유 기간: {PRIVACY_SUMMARY.period}
            <br />
            동의하지 않으면 가입할 수 없어요. <PrivacyLink className={styles.consentLink}>전체 보기</PrivacyLink>
          </p>
        </div>
        {error && (
          <p className={fields.error} role="alert">
            {error}
          </p>
        )}
        <p className={styles.stepHint}>다음을 누르면 입력한 이메일로 확인 메일을 보내드려요.</p>
        <div className={styles.submit}>
          <Button type="submit" disabled={!canSubmit || busy}>
            다음
          </Button>
        </div>
        <p className={styles.switch}>
          이미 계정이 있으신가요?{' '}
          <button type="button" className={fields.textLink} onClick={() => navigate(paths.login)}>
            로그인
          </button>
        </p>
      </form>
    </div>
  )
}
