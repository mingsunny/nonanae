import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import fields from './Field.module.css'
import { EyeIcon, EyeOffIcon } from './icons'
import styles from './PasswordInput.module.css'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'>

/** 눈 버튼으로 입력한 비밀번호를 보였다 숨겼다 할 수 있는 비밀번호 입력칸 (로그인·가입·재설정 공용) */
export default function PasswordInput(props: Props) {
  const [visible, setVisible] = useState(false)
  return (
    <div className={styles.wrap}>
      <input {...props} className={`${fields.input} ${styles.input}`} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className={styles.toggle}
        aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
      </button>
    </div>
  )
}
