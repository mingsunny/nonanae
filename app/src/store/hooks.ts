import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { findMyMember, memberDisplayName } from '../domain/members'
import type { GroupDetail, Member } from '../domain/types'
import { selectGroup, useAppStore } from './appStore'

/** URL의 :groupId에 해당하는 그룹. 내가 속하지 않았거나 없는 그룹이면 undefined. */
export function useCurrentGroup(): GroupDetail | undefined {
  const { groupId } = useParams()
  return useAppStore(selectGroup(groupId))
}

export interface GroupView {
  /** memberId → 표시 이름 */
  nameOf: (memberId: string) => string
  /** 그룹 안의 "나". 로그인 여부에 따라 userId 또는 viewAsMemberId로 판별 */
  me: Member | undefined
  isMe: (memberId: string) => boolean
  /** 계정 없이 이름만 있는(대기 중 또는 게스트) 멤버이면서 내가 아닌 경우 */
  isPending: (member: Member) => boolean
}

/** 그룹 화면들이 공통으로 쓰는 이름/나 판별 헬퍼 */
export function useGroupView(group: GroupDetail): GroupView {
  const usersById = useAppStore((s) => s.usersById)
  const currentUserId = useAppStore((s) => s.currentUserId)
  const viewAsMemberId = useAppStore((s) => s.viewAsMemberId)

  return useMemo(() => {
    const names = new Map(group.members.map((m) => [m.id, memberDisplayName(m, usersById)]))
    const me = findMyMember(group.members, currentUserId, viewAsMemberId)
    return {
      nameOf: (memberId) => names.get(memberId) ?? '알 수 없음',
      me,
      isMe: (memberId) => me?.id === memberId,
      isPending: (member) => member.userId === null && member.id !== me?.id,
    }
  }, [group.members, usersById, currentUserId, viewAsMemberId])
}
