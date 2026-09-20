import { describe, expect, it } from 'vitest'
import { sortGroupsNewestFirst } from './members'
import type { Member } from './types'

const member = (id: string, userId: string | null, joinedAt: string): Member => ({
  id,
  userId,
  groupId: 'g',
  role: 'member',
  name: userId === null ? id : null,
  joinedAt,
})

const group = (id: string, ...members: Member[]) => ({ id, members })

describe('sortGroupsNewestFirst', () => {
  const older = group('older', member('a', 'u_me', '2026-09-01T00:00:00.000Z'))
  const newer = group('newer', member('b', 'u_me', '2026-09-10T00:00:00.000Z'))

  it('내가 그 그룹에 들어온 시각이 최근인 그룹이 위다', () => {
    expect(sortGroupsNewestFirst([older, newer], 'u_me', null).map((g) => g.id)).toEqual(['newer', 'older'])
  })

  it('다른 사람이 더 나중에 들어왔어도 내 참여 시각을 기준으로 한다', () => {
    const lateFriend = group(
      'older',
      member('a', 'u_me', '2026-09-01T00:00:00.000Z'),
      member('c', 'u_friend', '2026-09-30T00:00:00.000Z'),
    )
    expect(sortGroupsNewestFirst([lateFriend, newer], 'u_me', null).map((g) => g.id)).toEqual(['newer', 'older'])
  })

  it('참여 시각이 같으면 배열에서 뒤에 있는 그룹이 위다', () => {
    const a = group('a', member('m1', 'u_me', '2026-09-01T00:00:00.000Z'))
    const b = group('b', member('m2', 'u_me', '2026-09-01T00:00:00.000Z'))
    expect(sortGroupsNewestFirst([a, b], 'u_me', null).map((g) => g.id)).toEqual(['b', 'a'])
  })

  it('로그인 없이 참여한 게스트는 viewAsMemberId로 내 자리를 찾는다', () => {
    const guestGroup = group('guest', member('m_guest', null, '2026-09-05T00:00:00.000Z'))
    // older에는 내 자리(m_guest)가 없어 맨 뒤로 간다
    expect(sortGroupsNewestFirst([older, guestGroup], null, 'm_guest').map((g) => g.id)).toEqual(['guest', 'older'])
  })

  it('원본 배열은 바꾸지 않는다', () => {
    const input = [older, newer]
    sortGroupsNewestFirst(input, 'u_me', null)
    expect(input.map((g) => g.id)).toEqual(['older', 'newer'])
  })
})
