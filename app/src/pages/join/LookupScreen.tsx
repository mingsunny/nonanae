import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/common/Button'
import Callout from '../../components/common/Callout'
import fields from '../../components/common/Field.module.css'
import Topbar from '../../components/common/Topbar'
import { paths } from '../../routes/paths'
import { useAppStore } from '../../store/appStore'
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
  const navigate = useNavigate()
  const currentUserId = useAppStore((s) => s.currentUserId)
  const viewAsMemberId = useAppStore((s) => s.viewAsMemberId)
  const groups = useAppStore((s) => s.groups)
  // 이미 이 기기에서 참여 중인 그룹: 방장이 초대코드를 새로 만들어도 참여 중인 멤버는 그룹 화면으로 계속 들어갈 수 있다.
  // 로그인한 회원은 그룹 목록으로, 게스트는 지금 보고 있는 자리의 그룹으로 안내한다.
  const guestGroup =
    currentUserId === null && viewAsMemberId !== null
      ? groups.find((g) => g.members.some((m) => m.id === viewAsMemberId))
      : undefined
  const hasOwnGroups = currentUserId !== null && groups.length > 0
  // 4자 미만이면 진행 불가 (06 예외처리)
  const canSubmit = code.trim().length >= 4

  function submit(e: FormEvent) {
    e.preventDefault()
    if (canSubmit && !busy) onSubmit()
  }

  return (
    <div>
      <Topbar title="초대코드로 참여" onBack={onBack} brand />
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
        {notFound && (
          <div className={styles.notFoundHelp}>
            <p className={styles.helpText}>
              방장이 초대코드를 새로 만들었다면 이전 코드와 초대 링크는 더 이상 쓸 수 없어요. 방장에게 새 초대코드나 링크를 받아주세요.
            </p>
            {guestGroup && (
              <Button variant="outline" type="button" onClick={() => navigate(paths.groupExpenses(guestGroup.id))}>
                이미 참여 중인 [{guestGroup.name}] 그룹으로 가기
              </Button>
            )}
            {hasOwnGroups && (
              <Button variant="outline" type="button" onClick={() => navigate(paths.groups)}>
                내 그룹 목록으로 가기
              </Button>
            )}
          </div>
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
