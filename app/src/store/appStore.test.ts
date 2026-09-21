import { beforeEach, describe, expect, it } from 'vitest'
import { resetMockData } from '../api'
import { selectGroup, selectHasUnreadNotifications, useAppStore } from './appStore'

beforeEach(async () => {
  await resetMockData()
  useAppStore.setState({
    status: 'idle',
    currentUserId: null,
    viewAsMemberId: null,
    usersById: {},
    groups: [],
    notifications: [],
  })
})

describe('useAppStore', () => {
  it('init: 세션·유저·그룹·알림을 불러오고 ready가 된다', async () => {
    await useAppStore.getState().init()
    const s = useAppStore.getState()
    expect(s.status).toBe('ready')
    expect(s.currentUserId).toBe('u_test')
    expect(s.usersById['u_seyeon'].name).toBe('박서연')
    expect(s.groups.map((g) => g.id)).toEqual(['g_jeju'])
    expect(selectHasUnreadNotifications(s)).toBe(true)
  })

  it('selectGroup: id로 그룹을 찾고, 없으면 undefined', async () => {
    await useAppStore.getState().init()
    expect(selectGroup('g_jeju')(useAppStore.getState())?.name).toBe('제주도 여행')
    expect(selectGroup('g_none')(useAppStore.getState())).toBeUndefined()
  })

  it('addExpense: 등록 후 스토어의 그룹 지출과 알림이 갱신된다', async () => {
    await useAppStore.getState().init()
    await useAppStore.getState().addExpense({
      groupId: 'g_jeju',
      paidBy: 'm_me',
      title: '택시',
      amount: 15000,
      category: '교통',
      receiptImageUrl: null,
      splitType: 'equal',
      spentAt: '2026-10-15',
      participants: [{ memberId: 'm_me', shareAmount: null }],
    })
    const s = useAppStore.getState()
    expect(selectGroup('g_jeju')(s)!.expenses).toHaveLength(7)
    expect(s.notifications[0].title).toBe('[제주도 여행]에 테스트님이 결제한 내역이 추가됐어요')
  })

  it('removeExpense / addPendingMember / markNotificationRead 도 스토어에 반영된다', async () => {
    const store = useAppStore.getState()
    await store.init()
    await store.removeExpense('e_1')
    await store.addPendingMember('g_jeju', '최수아')
    await store.markNotificationRead('n_2')
    const s = useAppStore.getState()
    const g = selectGroup('g_jeju')(s)!
    expect(g.expenses.some((e) => e.id === 'e_1')).toBe(false)
    expect(g.members.map((m) => m.name)).toContain('최수아')
    expect(selectHasUnreadNotifications(s)).toBe(false)
  })

  it('init은 두 번 불러도 다시 로드하지 않는다', async () => {
    await useAppStore.getState().init()
    await useAppStore.getState().removeExpense('e_1')
    await useAppStore.getState().init()
    expect(selectGroup('g_jeju')(useAppStore.getState())!.expenses).toHaveLength(5)
  })
})
