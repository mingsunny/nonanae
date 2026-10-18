import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import type { JoinResolution } from '../api'
import Topbar from '../components/common/Topbar'
import { parseInviteCode } from '../domain/inviteCode'
import { paths } from '../routes/paths'
import { useAppStore } from '../store/appStore'
import { showToast } from '../store/toastStore'
import InviteScreen from './join/InviteScreen'
import type { InviteResolution } from './join/InviteScreen'
import styles from './join/join.module.css'
import LookupScreen from './join/LookupScreen'
import GroupJoinScreen from './join/GroupJoinScreen'
import RejectedScreen from './join/RejectedScreen'
import type { PickResolution } from './join/GroupJoinScreen'
import WaitingScreen from './join/WaitingScreen'

/**
 * 06 초대코드로 참여 → 그룹 이름 + 참여하기(공용 코드, 또는 개인 초대 링크의 그 자리로) → 그룹장 승인 대기.
 * 모두 `/join` 한 경로 안의 단계다. 카카오톡 공유 링크(`/join?code=ABCDEF`)나 개인 초대 링크
 * (`/join?code=ABCDEF-{memberId}`)로 들어오면 코드 입력 화면 없이 바로 확인한다. 로그인 여부와 무관하게 누구나
 * 들어올 수 있지만, 그룹에 들어가려면 그룹장 승인이 필요하다 (이미 그 그룹 멤버인 재입장만 바로 들어간다).
 * 승인 대기 중에는 주소에 코드를 남겨 두어, 새로고침하거나 같은 링크를 다시 열면 승인 여부를 이어서 확인한다.
 */
export default function JoinPage() {
  // 이메일 확인은 마쳤지만 이름·계좌를 아직 등록하지 않은 계정은 참여할 수 없다 — 먼저 계좌 등록으로 (마친 뒤 이 주소로 돌아온다)
  const needsProfile = useAppStore((s) => s.needsProfile)
  if (needsProfile) return <Navigate to={paths.signupAccount} replace />
  return <JoinFlow />
}

function JoinFlow() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const codeFromLink = params.get('code') ?? ''
  const isLoggedIn = useAppStore((s) => s.currentUserId !== null)
  const resolveInviteCode = useAppStore((s) => s.resolveInviteCode)

  const [code, setCode] = useState(codeFromLink)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pick, setPick] = useState<PickResolution | null>(null)
  const [invite, setInvite] = useState<InviteResolution | null>(null)
  // 링크로 들어와 첫 확인이 끝나기 전 — 코드 입력 화면(긴 코드)을 잠깐 보여주지 않도록
  const [linkPending, setLinkPending] = useState(codeFromLink !== '')
  const [waiting, setWaiting] = useState<{ groupId: string; groupName: string } | null>(null)
  const [rejected, setRejected] = useState<Extract<JoinResolution, { kind: 'rejected' }> | null>(null)
  // 개발 모드의 StrictMode는 effect를 두 번 실행하므로, 링크로 들어왔을 때 자동 확인이 두 번(=두 번 참여) 돌지 않게 막음
  const autoRan = useRef(false)

  const enterGroup = useCallback(
    (groupId: string) => navigate(paths.groupExpenses(groupId), { replace: true }),
    [navigate],
  )

  // 승인 대기로 넘어갈 때 주소에 코드를 남김 → 새로고침해도 이 그룹의 승인 여부를 다시 확인한다
  const startWaiting = useCallback(
    (next: { groupId: string; groupName: string }, raw: string) => {
      setWaiting(next)
      setParams({ code: raw.trim() }, { replace: true })
    },
    [setParams],
  )

  // 코드 입력으로 돌아갈 때는 개인 초대 링크의 긴 꼬리를 떼고 그룹 코드만 남긴다
  const backToLookup = useCallback(() => {
    setWaiting(null)
    setRejected(null)
    setPick(null)
    setInvite(null)
    setCode((prev) => parseInviteCode(prev).code)
    setParams({}, { replace: true })
  }, [setParams])

  const lookup = useCallback(
    async (raw: string) => {
      setBusy(true)
      try {
        const result = await resolveInviteCode(raw)
        if (result.kind === 'not-found') {
          setNotFound(true)
        } else if (result.kind === 'joined') {
          // 재입장(또는 승인 뒤 처음 들어옴)이면 안내 없이 바로 그룹으로 (06 액션 & 결과)
          enterGroup(result.groupId)
        } else if (result.kind === 'requested') {
          startWaiting(result, raw)
        } else if (result.kind === 'rejected') {
          setRejected(result)
        } else if (result.kind === 'invite') {
          setInvite(result)
        } else {
          setPick(result)
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : '코드를 확인하지 못했어요')
      } finally {
        setBusy(false)
        setLinkPending(false)
      }
    },
    [enterGroup, resolveInviteCode, startWaiting],
  )

  useEffect(() => {
    if (codeFromLink !== '' && !autoRan.current) {
      autoRan.current = true
      void lookup(codeFromLink)
    }
  }, [codeFromLink, lookup])

  if (waiting) {
    return (
      <WaitingScreen
        groupId={waiting.groupId}
        groupName={waiting.groupName}
        onJoined={enterGroup}
        onBack={backToLookup}
        onEnded={() => {
          // 대기 중에 거절됨 → 같은 코드로 다시 확인하면 거절 화면(또는 요청 전 화면)이 나온다
          setWaiting(null)
          void lookup(code)
        }}
      />
    )
  }

  if (rejected) {
    return (
      <RejectedScreen
        groupName={rejected.groupName}
        onBack={backToLookup}
        onRetry={() => {
          setRejected(null)
          if (rejected.retry.kind === 'invite') setInvite(rejected.retry)
          else setPick(rejected.retry)
        }}
      />
    )
  }

  if (invite) {
    return (
      <InviteScreen
        invite={invite}
        code={code}
        onBack={backToLookup}
        // 이미 승인된 자리면 바로 멤버가 되므로, 같은 코드로 다시 확인해 그룹(또는 대기 화면)으로 보낸다
        onRequested={() => void lookup(code)}
      />
    )
  }

  if (pick) {
    return (
      <GroupJoinScreen
        pick={pick}
        code={code}
        onBack={() => setPick(null)}
        onRequested={() => startWaiting(pick, code)}
      />
    )
  }

  if (linkPending) {
    return (
      <div>
        <Topbar title="초대코드로 참여" brand />
        <div className={styles.body}>
          <p className={styles.plain} role="status">
            초대 정보를 확인하고 있어요…
          </p>
        </div>
      </div>
    )
  }

  return (
    <LookupScreen
      code={code}
      onCodeChange={(next) => {
        setCode(next)
        setNotFound(false)
      }}
      notFound={notFound}
      busy={busy}
      onSubmit={() => lookup(code)}
      // 로그인 상태면 그룹 목록으로, 아니면 인트로로 (06 액션 & 결과)
      onBack={() => navigate(isLoggedIn ? paths.groups : paths.welcome)}
    />
  )
}
