import type { FormEvent } from 'react'
import Button from '../../components/common/Button'
import Callout from '../../components/common/Callout'
import fields from '../../components/common/Field.module.css'
import Topbar from '../../components/common/Topbar'
import styles from './join.module.css'

interface Props {
  code: string
  onCodeChange: (code: string) => void
  /** 코드를 찾지 못했을 때 */
  notFound: boolean
  busy: boolean
  onSubmit: () => void
  onBack: () => void
}

/** 06 초대코드 입력. 로그인 여부와 무관하게 같은 화면을 쓰는 공용 진입점. */
export default function LookupScreen({ code, onCodeChange, notFound, busy, onSubmit, onBack }: Props) {
  // 4자 미만이면 진행 불가 (06 예외처리)
  const canSubmit = code.trim().length >= 4

  function submit(e: FormEvent) {
    e.preventDefault()
    if (canSubmit && !busy) onSubmit()
  }

  return (
    <div>
      <Topbar title="초대코드로 참여" onBack={onBack} />
      <form className={styles.body} onSubmit={submit}>
        <Callout>
          로그인하지 않아도 참여할 수 있어요.
          <br />
          다만 계좌 등록 같은 일부 기능은 제한돼요.
        </Callout>
        <label className={fields.label} htmlFor="jl-code-input">
          초대코드
        </label>
        <input
          id="jl-code-input"
          className={`${fields.input} ${styles.code}`}
          type="text"
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="예) 4B7K2P"
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
        />
        {notFound && (
          <p className={fields.error} role="alert">
            일치하는 그룹을 찾을 수 없어요. 코드를 다시 확인해주세요.
          </p>
        )}
        <div className={styles.submit}>
          <Button type="submit" disabled={!canSubmit || busy}>
            다음
          </Button>
        </div>
      </form>
    </div>
  )
}
