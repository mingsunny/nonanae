import { useState } from 'react'
import type { FormEvent } from 'react'
import type { JoinResolution } from '../../api'
import Avatar from '../../components/common/Avatar'
import Button from '../../components/common/Button'
import Callout from '../../components/common/Callout'
import fields from '../../components/common/Field.module.css'
import Topbar from '../../components/common/Topbar'
import { useAppStore } from '../../store/appStore'
import { showToast } from '../../store/toastStore'
import styles from './join.module.css'

export type PickResolution = Extract<JoinResolution, { kind: 'pick' }>

interface Props {
  pick: PickResolution
  onBack: () => void
  /** 참여가 끝나 그룹 안으로 들어갈 때 */
  onJoined: (groupId: string) => void
}

/**
 * 07 참여하기 (멤버 매칭) — 공용 코드로 들어왔을 때 그룹 멤버 목록에서 본인을 고르거나, 없으면 새로 참여한다.
 * 이미 계정이 연결된 멤버는 고를 수 없다. 로그인 여부에 따라 "새로 참여"의 모양이 다르다(이름 입력 / 내 계정으로).
 */
export default function PickScreen({ pick, onBack, onJoined }: Props) {
  const isLoggedIn = useAppStore((s) => s.currentUserId !== null)
  const joinAsExistingMember = useAppStore((s) => s.joinAsExistingMember)
  const joinAsNewGuest = useAppStore((s) => s.joinAsNewGuest)
  const joinAsNewAccountMember = useAppStore((s) => s.joinAsNewAccountMember)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    try {
      await action()
      onJoined(pick.groupId)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '참여하지 못했어요')
      setBusy(false)
    }
  }

  function submitNewName(e: FormEvent) {
    e.preventDefault()
    if (newName.trim() !== '') void run(() => joinAsNewGuest(pick.groupId, newName))
  }

  return (
    <div>
      <Topbar title="참여하기" onBack={onBack} />
      <div className={styles.body}>
        <Callout>[{pick.groupName}] 그룹에 참여해요. 본인이 누구인지 골라주세요.</Callout>

        <div className={styles.list}>
          {pick.candidates.map((c) =>
            c.hasAccount ? (
              <div key={c.id} className={styles.person}>
                <Avatar name={c.name} />
                <div className={styles.info}>
                  <div className={styles.name}>{c.name}</div>
                  <div className={styles.sub}>이미 가입됨</div>
                </div>
              </div>
            ) : (
              <button
                key={c.id}
                type="button"
                className={styles.person}
                disabled={busy}
                onClick={() => run(() => joinAsExistingMember(pick.groupId, c.id))}
              >
                <Avatar name={c.name} />
                <span className={`${styles.info} ${styles.name}`}>{c.name}</span>
                <span className={styles.checkbox} aria-hidden="true" />
              </button>
            ),
          )}
        </div>

        {isLoggedIn ? (
          <div>
            <p className={styles.plain}>목록에 없으면 새 멤버로 참여할 수 있어요.</p>
            <Button variant="outline" disabled={busy} onClick={() => run(() => joinAsNewAccountMember(pick.groupId))}>
              새 멤버로 참여하기
            </Button>
          </div>
        ) : (
          <form onSubmit={submitNewName}>
            <label className={fields.label} htmlFor="jp-new-name">
              목록에 없으면 이름을 입력해주세요
            </label>
            <input
              id="jp-new-name"
              className={fields.input}
              type="text"
              placeholder="예) 김민지"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div className={styles.addButton}>
              <Button type="submit" disabled={newName.trim() === '' || busy}>
                이 이름으로 참여하기
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
