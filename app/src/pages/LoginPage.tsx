import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { paths } from '../routes/paths'
import AccountScreen from './auth/AccountScreen'
import IntroScreen from './auth/IntroScreen'
import LoginScreen from './auth/LoginScreen'
import SignupScreen from './auth/SignupScreen'

/** 01·02가 `/login` 한 경로 안에서 단계로 나뉜다 (conventions "URL 경로": 06→07처럼 같은 경로 안의 단계 전환). */
type Step = 'intro' | 'login' | 'signup' | 'account'

/** 회원가입 1단계 입력값. 2단계에서 뒤로 돌아와도 남아 있도록 여기서 들고 있다 (02 진입 경로). */
export interface SignupDraft {
  email: string
  password: string
  passwordConfirm: string
}

/**
 * 01 인트로 / 로그인 / 회원가입 1단계, 02 회원가입 2단계.
 * 앱을 열면 인트로가 먼저 뜨고, 로그아웃·탈퇴 후에는 `navigate(paths.login, { state: { step: 'login' } })`로
 * 인트로를 건너뛰고 로그인 화면으로 온다 (04 액션 & 결과). 비밀번호 재설정(14)을 마치고 올 때는 state에
 * `notice`를 실어 보내면 로그인 화면 위에 안내 박스로 보여준다.
 */
export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const arrival = location.state as { step?: 'login'; notice?: string } | null

  const [step, setStep] = useState<Step>(arrival?.step === 'login' ? 'login' : 'intro')
  const [notice, setNotice] = useState<string | null>(arrival?.notice ?? null)
  const [loginEmail, setLoginEmail] = useState('')
  const [draft, setDraft] = useState<SignupDraft>({ email: '', password: '', passwordConfirm: '' })

  function openSignup() {
    // 비밀번호는 비우고, 이메일은 로그인 화면에 입력해둔 값을 이어서 채운다 (01 액션 & 결과)
    setDraft({ email: loginEmail, password: '', passwordConfirm: '' })
    setStep('signup')
  }

  switch (step) {
    case 'intro':
      return (
        <IntroScreen
          onLogin={() => setStep('login')}
          onSignup={openSignup}
          onJoin={() => navigate(paths.join)}
        />
      )
    case 'login':
      return (
        <LoginScreen
          email={loginEmail}
          onEmailChange={setLoginEmail}
          notice={notice}
          onBack={() => {
            setNotice(null) // 로그인 화면을 벗어나면 안내는 거둔다
            setStep('intro')
          }}
        />
      )
    case 'signup':
      return (
        <SignupScreen
          draft={draft}
          onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
          onBack={() => setStep('intro')}
          onNext={() => setStep('account')}
          onGoLogin={() => setStep('login')}
        />
      )
    case 'account':
      return <AccountScreen draft={draft} onBack={() => setStep('signup')} />
  }
}
