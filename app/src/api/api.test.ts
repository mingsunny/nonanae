import { beforeEach, describe, expect, it } from 'vitest'
import {
  addPendingMember,
  createExpense,
  deleteExpense,
  fetchSnapshot,
  markNotificationRead,
  notifyMemberJoined,
  resetMockData,
  updateExpense,
} from './index'
import type { ExpenseInput } from '../domain/types'

const newExpense = (overrides: Partial<ExpenseInput> = {}): ExpenseInput => ({
  groupId: 'g_jeju',
  paidBy: 'm_me',
  title: '  편의점  ',
  amount: 9000,
  category: '식비',
  receiptImageUrl: null,
  splitType: 'equal',
  spentAt: '2026-10-15',
  participants: [
    { memberId: 'm_me', shareAmount: null },
    { memberId: 'm_seyeon', shareAmount: null },
  ],
  ...overrides,
})

beforeEach(async () => {
  await resetMockData()
})

describe('fetchSnapshot', () => {
  it('내가 속한 그룹만 돌려준다 (초대코드 테스트방은 멤버가 아니라서 제외)', async () => {
    const { groups } = await fetchSnapshot()
    expect(groups.map((g) => g.id)).toEqual(['g_jeju'])
  })

  it('그룹에 멤버·지출(+참여자)이 묶여 있고, 멤버가 가리키는 User가 함께 온다', async () => {
    const { groups, users } = await fetchSnapshot()
    const jeju = groups[0]
    expect(jeju.members).toHaveLength(4)
    expect(jeju.expenses).toHaveLength(6)
    expect(jeju.expenses.find((e) => e.id === 'e_5')!.participants.map((p) => p.memberId)).toEqual([
      'm_seyeon',
      'm_hajun',
    ])
    expect(users.map((u) => u.id).sort()).toEqual(['u_doyoon', 'u_hajun', 'u_seyeon', 'u_test'])
  })

  it('알림은 내 그룹 것만, 최신순', async () => {
    const { notifications } = await fetchSnapshot()
    expect(notifications.map((n) => n.id)).toEqual(['n_2', 'n_1'])
  })

  it('돌려준 데이터를 수정해도 DB는 바뀌지 않는다', async () => {
    const first = await fetchSnapshot()
    first.groups[0].name = '바뀐 이름'
    const second = await fetchSnapshot()
    expect(second.groups[0].name).toBe('제주도 여행')
  })
})

describe('createExpense', () => {
  it('지출과 참여자 행을 저장하고, 항목명은 앞뒤 공백을 다듬는다', async () => {
    const created = await createExpense(newExpense())
    expect(created.title).toBe('편의점')
    const { groups } = await fetchSnapshot()
    const saved = groups[0].expenses.find((e) => e.id === created.id)!
    expect(saved.participants).toHaveLength(2)
    expect(groups[0].expenses).toHaveLength(7)
  })

  it('신규 등록이면 결제자 이름이 들어간 "내역 추가" 알림이 생기고 안 읽음 상태다', async () => {
    await createExpense(newExpense({ paidBy: 'm_seyeon' }))
    const { notifications } = await fetchSnapshot()
    expect(notifications[0]).toMatchObject({
      type: 'expense',
      groupId: 'g_jeju',
      title: '[제주도 여행]에 박서연님이 결제한 내역이 추가됐어요',
      read: false,
    })
  })

  it.each([
    ['금액이 0', { amount: 0 }],
    ['금액이 소수', { amount: 100.5 }],
    ['항목명이 공백', { title: '   ' }],
    ['참여자가 없음', { participants: [] }],
    ['결제자가 그룹 멤버가 아님', { paidBy: 'm_minji' }],
    ['참여자가 그룹 멤버가 아님', { participants: [{ memberId: 'm_minji', shareAmount: null }] }],
    [
      '참여자 중복',
      {
        participants: [
          { memberId: 'm_me', shareAmount: null },
          { memberId: 'm_me', shareAmount: null },
        ],
      },
    ],
    ['없는 그룹', { groupId: 'g_none' }],
  ] as [string, Partial<ExpenseInput>][])('잘못된 입력은 거절하고 아무것도 저장하지 않는다: %s', async (_name, overrides) => {
    await expect(createExpense(newExpense(overrides))).rejects.toThrow()
    const { groups, notifications } = await fetchSnapshot()
    expect(groups[0].expenses).toHaveLength(6)
    expect(notifications).toHaveLength(2)
  })
})

describe('updateExpense', () => {
  it('내용과 참여자를 바꾸고, 알림은 새로 만들지 않는다', async () => {
    await updateExpense(
      'e_6',
      newExpense({
        title: '기념품 쇼핑(수정)',
        amount: 60000,
        splitType: 'amount',
        participants: [
          { memberId: 'm_me', shareAmount: 40000 },
          { memberId: 'm_hajun', shareAmount: 20000 },
        ],
      }),
    )
    const { groups, notifications } = await fetchSnapshot()
    const e6 = groups[0].expenses.find((e) => e.id === 'e_6')!
    expect(e6).toMatchObject({ title: '기념품 쇼핑(수정)', amount: 60000, splitType: 'amount' })
    expect(e6.participants).toEqual([
      { expenseId: 'e_6', memberId: 'm_me', shareAmount: 40000 },
      { expenseId: 'e_6', memberId: 'm_hajun', shareAmount: 20000 },
    ])
    expect(groups[0].expenses).toHaveLength(6)
    expect(notifications).toHaveLength(2)
  })

  it('없는 지출이거나 다른 그룹으로 옮기려 하면 거절', async () => {
    await expect(updateExpense('e_none', newExpense())).rejects.toThrow()
    await expect(updateExpense('e_6', newExpense({ groupId: 'g_test42', paidBy: 'm_owner42' }))).rejects.toThrow()
  })
})

describe('deleteExpense', () => {
  it('지출과 참여자 행을 지우지만 이미 만든 알림은 그대로 둔다', async () => {
    await deleteExpense('e_6')
    const { groups, notifications } = await fetchSnapshot()
    expect(groups[0].expenses.map((e) => e.id)).not.toContain('e_6')
    expect(notifications.map((n) => n.id)).toContain('n_2')
  })

  it('없는 지출은 거절', async () => {
    await expect(deleteExpense('e_none')).rejects.toThrow()
  })
})

describe('addPendingMember', () => {
  it('userId 없는 멤버를 이름만으로 추가하고 알림은 만들지 않는다', async () => {
    const member = await addPendingMember('g_jeju', '  최수아 ')
    expect(member).toMatchObject({ userId: null, groupId: 'g_jeju', role: 'member', name: '최수아' })
    const { groups, notifications } = await fetchSnapshot()
    expect(groups[0].members).toHaveLength(5)
    expect(notifications).toHaveLength(2)
  })

  it('이름이 비어 있으면 거절', async () => {
    await expect(addPendingMember('g_jeju', '   ')).rejects.toThrow()
  })
})

describe('notifications', () => {
  it('markNotificationRead: 읽음 처리', async () => {
    await markNotificationRead('n_2')
    const { notifications } = await fetchSnapshot()
    expect(notifications.every((n) => n.read)).toBe(true)
  })

  it('notifyMemberJoined: 참여 알림 생성, 대상이 없으면 만들지 않음', async () => {
    await notifyMemberJoined('g_jeju', 'm_hajun')
    await notifyMemberJoined('g_jeju', 'm_none')
    const { notifications } = await fetchSnapshot()
    expect(notifications).toHaveLength(3)
    expect(notifications[0]).toMatchObject({
      type: 'member_joined',
      title: '이하준님이 [제주도 여행] 그룹에 참여했어요',
    })
  })
})
