import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/common/Button'
import fields from '../components/common/Field.module.css'
import Topbar from '../components/common/Topbar'
import { paths } from '../routes/paths'
import { useAppStore } from '../store/appStore'
import { showToast } from '../store/toastStore'
import styles from './CreateGroupPage.module.css'

/** 05. 새 그룹 만들기 — 그룹명만 입력하면 만들어지고, 곧바로 멤버 초대(12) 화면으로 이어진다. 정식 회원 전용. */
export default function CreateGroupPage() {
  const navigate = useNavigate()
  const createGroup = useAppStore((s) => s.createGroup)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  // 공백만 입력한 경우도 trim 후 빈 값이면 막음 (05 예외처리)
  const canSubmit = name.trim() !== ''

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || busy) return
    setBusy(true)
    try {
      const group = await createGroup(name)
      // 그룹 내부가 아니라 12를 먼저 거친다. fromCreation이면 12의 뒤로가기가 숨겨지고 "그룹으로 가기"가 유일한 출구가 됨
      navigate(paths.groupMembers(group.id), { state: { fromCreation: true } })
    } catch (err) {
      showToast(err instanceof Error ? err.message : '그룹을 만들지 못했어요')
      setBusy(false)
    }
  }

  return (
    <div>
      <Topbar title="새 그룹 만들기" backTo={paths.groups} />
      <form className={styles.body} onSubmit={submit}>
        <p className={styles.guide}>
          여행 이름으로 그룹을 만들면, 카카오톡으로
          <br />
          함께 간 친구들을 바로 초대할 수 있어요.
        </p>
        <label className={fields.label} htmlFor="new-group-name">
          그룹(여행) 이름
        </label>
        <input
          id="new-group-name"
          className={fields.input}
          type="text"
          placeholder="예) 제주도 우정여행"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className={styles.submit}>
          <Button type="submit" disabled={!canSubmit || busy}>
            그룹 만들기
          </Button>
        </div>
      </form>
    </div>
  )
}
