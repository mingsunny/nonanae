import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { paths } from '../routes/paths'
import { useAppStore } from '../store/appStore'
import { showToast } from '../store/toastStore'
import LookupScreen from './join/LookupScreen'
import PickScreen from './join/PickScreen'
import type { PickResolution } from './join/PickScreen'
import WaitingScreen from './join/WaitingScreen'

/**
 * 06 초대코드로 참여 → 07 참여하기(멤버 매칭) → 그룹장 승인 대기. 세 화면이 `/join` 한 경로 안의 단계다.
 * 카카오톡 공유 링크(`/join?code=ABCDEF`)나 개인 초대 링크(`/join?code=ABCDEF-{memberId}`)로 들어오면
 * 코드를 채우고 바로 확인한다. 로그인 여부와 무관하게 누구나 들어올 수 있지만, 그룹에 들어가려면 그룹장 승인이 필요하다
 * (이미 그 그룹 멤버인 재입장만 바로 들어간다).
 */
export default function JoinPage() {
  // 이메일 확인은 마쳤지만 이름·계좌를 아직 등록하지 않은 계정은 참여할 수 없다 — 먼저 계좌 등록으로 (마친 뒤 이 주소로 돌아온다)
  const needsProfile = useAppStore((s) => s.needsProfile)
  if (needsProfile) return <Navigate to={paths.signupAccount} replace />
  return <JoinFlow />
}

function JoinFlow() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const codeFromLink = params.get('code') ?? ''
  const isLoggedIn = useAppStore((s) => s.currentUserId !== null)
  const resolveInviteCode = useAppStore((s) => s.resolveInviteCode)

  const [code, setCode] = useState(codeFromLink)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pick, setPick] = useState<PickResolution | null>(null)
  const [waiting, setWaiting] = useState<{ groupId: string; groupName: string } | null>(null)
  // 개발 모드의 StrictMode는 effect를 두 번 실행하므로, 링크로 들어왔을 때 자동 확인이 두 번(=두 번 참여) 돌지 않게 막음
  const autoRan = useRef(false)

  const enterGroup = useCallback(
    (groupId: string) => navigate(paths.groupExpenses(groupId), { replace: true }),
    [navigate],
  )

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
          setWaiting({ groupId: result.groupId, groupName: result.groupName })
        } else {
          setPick(result)
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : '코드를 확인하지 못했어요')
      } finally {
        setBusy(false)
      }
    },
    [enterGroup, resolveInviteCode],
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
        onBack={() => {
          setWaiting(null)
          setPick(null)
        }}
      />
    )
  }

  if (pick) {
    return (
      <PickScreen
        pick={pick}
        code={code}
        onBack={() => setPick(null)}
        onRequested={() => setWaiting({ groupId: pick.groupId, groupName: pick.groupName })}
      />
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
