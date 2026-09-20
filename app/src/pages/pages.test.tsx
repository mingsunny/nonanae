// @vitest-environment jsdom
// 08~13 화면 테스트: jsdom에 실제로 렌더링하고, 시드 데이터로 표시 내용과 클릭/입력 동작을 확인한다.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetMockData } from '../api'
import { todayIso } from '../lib/format'
import ToastHost from '../components/common/Toast'
import NotificationBell from '../components/notifications/NotificationBell'
import GroupLayout from '../layouts/GroupLayout'
import { useAppStore } from '../store/appStore'
import { useToastStore } from '../store/toastStore'
import ExpenseFormPage from './ExpenseFormPage'
import ExpenseListPage from './ExpenseListPage'
import MemberInvitePage from './MemberInvitePage'
import SettlePage from './SettlePage'
import SummaryPage from './SummaryPage'

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="groups/:groupId" element={<GroupLayout />}>
          <Route path="expenses" element={<ExpenseListPage />} />
          <Route path="settle" element={<SettlePage />} />
          <Route path="summary" element={<SummaryPage />} />
        </Route>
        <Route path="groups/:groupId/expenses/new" element={<ExpenseFormPage />} />
        <Route path="groups/:groupId/expenses/:expenseId" element={<ExpenseFormPage />} />
        <Route path="groups/:groupId/members" element={<MemberInvitePage />} />
        <Route
          path="groups"
          element={
            <div>
              <p>그룹 목록으로 이동됨</p>
              <NotificationBell />
            </div>
          }
        />
      </Routes>
      <ToastHost />
    </MemoryRouter>,
  )
}

const text = () => document.body.textContent ?? ''
const groupState = () => useAppStore.getState().groups.find((g) => g.id === 'g_jeju')!
const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) }

/** 시드 그룹의 지출/멤버를 테스트용으로 바꿔 끼움 (스토어 상태만 바꾸고 목업 DB는 그대로) */
function patchGroup(patch: (g: ReturnType<typeof groupState>) => Partial<ReturnType<typeof groupState>>) {
  const { groups } = useAppStore.getState()
  useAppStore.setState({ groups: groups.map((g) => (g.id === 'g_jeju' ? { ...g, ...patch(g) } : g)) })
}

beforeEach(async () => {
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true })
  clipboard.writeText.mockClear()
  useToastStore.setState({ message: null })
  await resetMockData()
  useAppStore.setState({ status: 'idle' })
  await useAppStore.getState().init()
})

afterEach(cleanup)

describe('그룹 헤더 (08/09/10 공용)', () => {
  it('그룹명, 총 사용 금액, 초대 버튼, 하단 탭바', () => {
    renderAt('/groups/g_jeju/expenses')
    expect(text()).toContain('제주도 여행')
    expect(text()).toContain('₩958,000')
    expect(screen.getByText('멤버 초대')).toBeTruthy()
    for (const tab of ['지출', '정산', '요약']) expect(screen.getByRole('link', { name: tab })).toBeTruthy()
  })

  it('"초대 코드 복사"는 코드를 복사하고 토스트를 띄운다', async () => {
    renderAt('/groups/g_jeju/expenses')
    await userEvent.click(screen.getByRole('button', { name: '초대 코드 복사' }))
    expect(clipboard.writeText).toHaveBeenCalledWith('JEJU26')
    expect(await screen.findByText('초대코드가 복사되었습니다')).toBeTruthy()
  })

  it('내가 속하지 않은 그룹/없는 그룹은 그룹 목록으로 보낸다', () => {
    renderAt('/groups/g_test42/expenses')
    expect(text()).toContain('그룹 목록으로 이동됨')
    cleanup()
    renderAt('/groups/g_none/expenses')
    expect(text()).toContain('그룹 목록으로 이동됨')
  })

  it('탭을 누르면 헤더는 그대로 두고 내용만 바뀐다', async () => {
    renderAt('/groups/g_jeju/expenses')
    await userEvent.click(screen.getByRole('link', { name: '요약' }))
    expect(await screen.findByText('카테고리별')).toBeTruthy()
    expect(text()).toContain('₩958,000')
  })
})

describe('08 지출 내역', () => {
  it('날짜는 최신순, 항목에 결제자·나눔 인원(일부 표시)', () => {
    renderAt('/groups/g_jeju/expenses')
    const t = text()
    expect(t.indexOf('10월 14일')).toBeLessThan(t.indexOf('10월 13일'))
    expect(t.indexOf('10월 13일')).toBeLessThan(t.indexOf('10월 12일'))
    expect(t).toContain('박서연 결제 · 4명 나눔')
    expect(screen.getByText('스노클링 체험').closest('a')!.textContent).toContain('박서연 결제 · 3명 나눔 (일부)')
  })

  it('항목을 누르면 수정 폼, FAB를 누르면 신규 폼으로 간다', async () => {
    renderAt('/groups/g_jeju/expenses')
    expect(screen.getByRole('link', { name: '지출 추가' }).getAttribute('href')).toBe('/groups/g_jeju/expenses/new')
    await userEvent.click(screen.getByText('오후 카페'))
    expect(await screen.findByText('지출 수정')).toBeTruthy()
  })

  it('지출이 없을 때: 나 혼자면 초대 안내, 멤버가 있으면 첫 지출 안내 + FAB 강조', () => {
    patchGroup(() => ({ expenses: [] }))
    renderAt('/groups/g_jeju/expenses')
    expect(text()).toContain('아직 등록된 지출이 없어요.')
    expect(screen.getByRole('link', { name: '지출 추가' }).className).toContain('glow')
    cleanup()

    patchGroup((g) => ({ expenses: [], members: g.members.slice(0, 1) }))
    renderAt('/groups/g_jeju/expenses')
    expect(text()).toContain('정산할 친구를 초대해주세요.')
    expect(screen.getByRole('link', { name: '지출 추가' }).className).not.toContain('glow')
  })
})

describe('09 정산', () => {
  it('내가 보낼 송금 맨 위 + 받는 사람 계좌, 탭하면 복사', async () => {
    renderAt('/groups/g_jeju/settle')
    expect(text()).toContain('가장 적은 횟수로 정산할 수 있도록 계산했어요')
    // 테스트 계정(나)은 잔액이 -64,500원 → 받을 사람들에게 나눠 보낸다
    const first = screen.getAllByText('테스트 (나)')[0].closest('div')!.parentElement!
    const accountButton = within(first).getAllByRole('button')[0]
    expect(accountButton.textContent).toContain('탭해서 계좌번호 복사')
    await userEvent.click(accountButton)
    expect(clipboard.writeText).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('계좌번호가 복사되었습니다')).toBeTruthy()
  })

  it('다른 사람 간 송금에는 계좌를 렌더링하지 않는다', () => {
    renderAt('/groups/g_jeju/settle')
    const rows = screen.getAllByText('→').map((arrow) => arrow.parentElement!.parentElement!)
    const withAccount = rows.filter((r) => r.textContent!.includes('탭해서 계좌번호 복사'))
    for (const row of rows) {
      const isMine = row.querySelector('span')!.textContent === '테스트 (나)'
      expect(row.textContent!.includes('탭해서 계좌번호 복사') || row.textContent!.includes('등록된 계좌가 없어요')).toBe(isMine)
    }
    expect(withAccount.length).toBeGreaterThan(0)
  })

  it('지출이 없으면 빈 상태', () => {
    patchGroup(() => ({ expenses: [] }))
    renderAt('/groups/g_jeju/settle')
    expect(text()).toContain('아직 등록된 지출이 없어요.')
  })

  it('받는 사람이 계좌 없는 대기 중 멤버면 방어 문구만 나오고 복사 버튼은 없다', () => {
    patchGroup((g) => ({
      members: [...g.members, { id: 'm_p', userId: null, groupId: 'g_jeju', role: 'member', name: '최수아', joinedAt: '' }],
      expenses: [
        {
          id: 'e_p', groupId: 'g_jeju', paidBy: 'm_p', title: '택시', amount: 10000, category: '교통',
          receiptImageUrl: null, splitType: 'equal', spentAt: '2026-10-15', createdAt: '',
          participants: [{ expenseId: 'e_p', memberId: 'm_me', shareAmount: null }],
        },
      ],
    }))
    renderAt('/groups/g_jeju/settle')
    expect(text()).toContain('등록된 계좌가 없어요. 최수아님에게 직접 확인해주세요')
    expect(text()).not.toContain('탭해서 계좌번호 복사')
  })

  it('전원 잔액이 0이면 완료 문구', () => {
    const expense = (id: string, paidBy: string) => ({
      id, groupId: 'g_jeju', paidBy, title: id, amount: 2000, category: '식비' as const,
      receiptImageUrl: null, splitType: 'equal' as const, spentAt: '2026-10-15', createdAt: '',
      participants: ['m_me', 'm_seyeon'].map((memberId) => ({ expenseId: id, memberId, shareAmount: null })),
    })
    patchGroup(() => ({ expenses: [expense('a', 'm_me'), expense('b', 'm_seyeon')] }))
    renderAt('/groups/g_jeju/settle')
    expect(text()).toContain('정산할 금액이 없어요.')
  })
})

describe('10 요약', () => {
  it('카테고리별 금액·비율과 인원별 결제·잔액', () => {
    renderAt('/groups/g_jeju/summary')
    const t = text()
    expect(t).toContain('숙소')
    expect(t).toContain('38%') // 360000 / 958000
    expect(t).toContain('테스트 (나)')
    expect(t).toContain('결제 ₩184,000')
    expect(t).toContain('보낼 돈')
    expect(t).toContain('받을 돈')
  })

  it('지출이 없으면 두 섹션에 각각 빈 상태', () => {
    patchGroup(() => ({ expenses: [] }))
    renderAt('/groups/g_jeju/summary')
    expect(text().match(/아직 등록된 지출이 없어요\./g)).toHaveLength(2)
  })
})

describe('11 지출 폼', () => {
  const fillBasics = async (amount: string, title: string) => {
    await userEvent.type(screen.getByLabelText('사용 금액'), amount)
    await userEvent.type(screen.getByLabelText('항목명'), title)
  }

  it('신규: 전원 선택 + 균등 분담이 실시간으로 표시되고, 필수값이 채워지면 제출 가능', async () => {
    renderAt('/groups/g_jeju/expenses/new')
    expect(text()).toContain('지출 추가')
    expect(screen.queryByText('이 지출 삭제하기')).toBeNull()
    expect(screen.getAllByRole('checkbox').every((c) => c.getAttribute('aria-checked') === 'true')).toBe(true)

    const submit = screen.getByRole('button', { name: '지출 등록하기' }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    await fillBasics('10000', '택시')
    expect(submit.disabled).toBe(false)
    expect(text()).toContain('₩2,500')
  })

  it('신규: 사용 날짜 기본값은 오늘', () => {
    renderAt('/groups/g_jeju/expenses/new')
    expect((screen.getByLabelText('사용 날짜') as HTMLInputElement).value).toBe(todayIso())
  })

  it('신규 등록: 저장되고 08로 돌아가며 알림이 생긴다', async () => {
    renderAt('/groups/g_jeju/expenses/new')
    await fillBasics('10000', '택시')
    await userEvent.click(screen.getByRole('button', { name: '지출 등록하기' }))

    expect(await screen.findByText('지출이 등록되었습니다')).toBeTruthy()
    expect(text()).toContain('택시')
    expect(groupState().expenses).toHaveLength(7)
    const added = groupState().expenses.at(-1)!
    expect(added).toMatchObject({ title: '택시', amount: 10000, paidBy: 'm_me', splitType: 'equal', category: '식비' })
    expect(useAppStore.getState().notifications[0].title).toBe('테스트님이 [제주도 여행]에 내역을 추가했어요')
  })

  it('참여자를 해제하면 분담이 재계산되고, 마지막 1명은 해제할 수 없다', async () => {
    renderAt('/groups/g_jeju/expenses/new')
    await fillBasics('9000', '간식')
    const boxes = screen.getAllByRole('checkbox')
    await userEvent.click(boxes[1])
    await userEvent.click(boxes[2])
    expect(text()).toContain('₩4,500') // 2명 균등
    await userEvent.click(boxes[3])
    await userEvent.click(boxes[0])
    expect(await screen.findByText('최소 1명은 선택되어야 해요')).toBeTruthy()
    expect(boxes[0].getAttribute('aria-checked')).toBe('true')
  })

  it('비율: 전환하면 균등값으로 채워지고, 합계가 100%가 아니면 제출 불가 + 붉은 안내', async () => {
    renderAt('/groups/g_jeju/expenses/new')
    await fillBasics('10000', '저녁')
    await userEvent.click(screen.getByRole('radio', { name: '비율' }))
    const mine = screen.getByLabelText('테스트 비율') as HTMLInputElement
    expect(mine.value).toBe('25')
    expect(screen.getByRole('status').textContent).toContain('합계 100% / 100%')

    await userEvent.clear(mine)
    await userEvent.type(mine, '40')
    const summary = screen.getByRole('status')
    expect(summary.textContent).toContain('합계 115% / 100%')
    expect(summary.className).toContain('bad')
    expect((screen.getByRole('button', { name: '지출 등록하기' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('금액: 총액과 합계가 맞으면 제출되고 확정된 분담액이 저장된다', async () => {
    renderAt('/groups/g_jeju/expenses/new')
    await fillBasics('10000', '렌트')
    await userEvent.click(screen.getByRole('radio', { name: '금액' }))
    for (const [label, value] of [['테스트 금액', '4000'], ['박서연 금액', '3000'], ['김도윤 금액', '2000'], ['이하준 금액', '1000']]) {
      const input = screen.getByLabelText(label)
      await userEvent.clear(input)
      await userEvent.type(input, value)
    }
    expect(screen.getByRole('status').textContent).toContain('합계 ₩10,000 / ₩10,000')
    await userEvent.click(screen.getByRole('button', { name: '지출 등록하기' }))
    await screen.findByText('지출이 등록되었습니다')

    const saved = groupState().expenses.find((e) => e.title === '렌트')!
    expect(saved.splitType).toBe('amount')
    expect(saved.participants.map((p) => [p.memberId, p.shareAmount])).toEqual([
      ['m_me', 4000], ['m_seyeon', 3000], ['m_doyoon', 2000], ['m_hajun', 1000],
    ])
  })

  it('수정: 기존 값이 채워져 있고, 저장하면 반영되지만 알림은 새로 생기지 않는다', async () => {
    const notificationCount = useAppStore.getState().notifications.length
    renderAt('/groups/g_jeju/expenses/e_4')
    expect(text()).toContain('지출 수정')
    expect((screen.getByLabelText('항목명') as HTMLInputElement).value).toBe('스노클링 체험')
    expect((screen.getByLabelText('사용 금액') as HTMLInputElement).value).toBe('180000')
    expect((screen.getByLabelText('사용 날짜') as HTMLInputElement).value).toBe('2026-10-13')
    expect(text()).toContain('₩60,000')

    const title = screen.getByLabelText('항목명')
    await userEvent.clear(title)
    await userEvent.type(title, '스노클링(수정)')
    await userEvent.click(screen.getByRole('button', { name: '저장하기' }))
    expect(await screen.findByText('지출이 수정되었습니다')).toBeTruthy()

    expect(groupState().expenses.find((e) => e.id === 'e_4')!.title).toBe('스노클링(수정)')
    expect(useAppStore.getState().notifications).toHaveLength(notificationCount)
  })

  it('수정: 삭제하면 확인 후 지출이 사라진다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderAt('/groups/g_jeju/expenses/e_5')
    await userEvent.click(screen.getByText('이 지출 삭제하기'))
    expect(await screen.findByText('지출이 삭제되었습니다')).toBeTruthy()
    expect(groupState().expenses.some((e) => e.id === 'e_5')).toBe(false)
  })

  it('삭제 확인을 취소하면 아무 일도 없다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderAt('/groups/g_jeju/expenses/e_5')
    await userEvent.click(screen.getByText('이 지출 삭제하기'))
    expect(groupState().expenses.some((e) => e.id === 'e_5')).toBe(true)
  })

  it('없는 지출을 수정하려 하면 08로 돌려보낸다', () => {
    renderAt('/groups/g_jeju/expenses/e_none')
    expect(text()).not.toContain('지출 수정')
    expect(text()).toContain('₩958,000')
  })

  it('큰 영수증 사진은 거절하고 토스트를 띄운다', async () => {
    renderAt('/groups/g_jeju/expenses/new')
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })
    await userEvent.upload(input, big)
    expect(await screen.findByText('사진 용량이 너무 커요. 2MB 이하로 골라주세요')).toBeTruthy()
    expect(screen.queryByAltText('영수증 미리보기')).toBeNull()
  })
})

describe('12 멤버 초대', () => {
  it('멤버 목록과 추가 입력 (대기 중 멤버가 없으면 배지도 없음)', () => {
    renderAt('/groups/g_jeju/members')
    expect(text()).toContain('멤버 목록')
    expect(text()).toContain('박서연')
    expect(text()).toContain('테스트 (나)')
    expect(text()).not.toContain('초대 대기 중')
    expect((screen.getByRole('button', { name: '추가' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('하단 "그룹으로 가기"는 항상 보이고, 누르면 08로 간다', async () => {
    renderAt('/groups/g_jeju/members')
    expect(screen.getByRole('link', { name: '그룹으로' })).toBeTruthy() // 상단 back
    await userEvent.click(screen.getByRole('button', { name: '그룹으로 가기' }))
    expect(await screen.findByText('₩958,000')).toBeTruthy()
  })

  it('그룹 생성 직후(fromCreation)에는 상단 back만 숨기고 "그룹으로 가기"는 그대로 있다', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/groups/g_jeju/members', state: { fromCreation: true } }]}>
        <Routes>
          <Route path="groups/:groupId/members" element={<MemberInvitePage />} />
          <Route path="groups/:groupId/expenses" element={<p>지출 탭</p>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.queryByRole('link', { name: '그룹으로' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '그룹으로 가기' }))
    expect(await screen.findByText('지출 탭')).toBeTruthy()
  })

  it('이름을 추가하면 대기 중 멤버로 들어가고 토스트가 뜬다 (알림은 만들지 않음)', async () => {
    const notificationCount = useAppStore.getState().notifications.length
    renderAt('/groups/g_jeju/members')
    await userEvent.type(screen.getByLabelText('친구를 추가한 뒤 초대해봐요.'), '최수아')
    await userEvent.click(screen.getByRole('button', { name: '추가' }))

    expect(await screen.findByText('최수아님을 추가했어요')).toBeTruthy()
    expect(screen.getByText('초대 대기 중')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: '초대 보내기' })).toHaveLength(1)
    expect(useAppStore.getState().notifications).toHaveLength(notificationCount)
    expect((screen.getByLabelText('친구를 추가한 뒤 초대해봐요.') as HTMLInputElement).value).toBe('')
  })

  it('"초대 보내기"는 그 멤버 전용 링크(초대코드-멤버id)를 복사한다', async () => {
    renderAt('/groups/g_jeju/members')
    await userEvent.type(screen.getByLabelText('친구를 추가한 뒤 초대해봐요.'), '최수아')
    await userEvent.click(screen.getByRole('button', { name: '추가' }))
    await userEvent.click(await screen.findByRole('button', { name: '초대 보내기' }))

    const pending = groupState().members.find((m) => m.name === '최수아')!
    expect(clipboard.writeText).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`/join\\?code=JEJU26-${pending.id}$`)))
    expect(await screen.findByText('최수아님에게 보낼 초대 링크를 복사했어요')).toBeTruthy()
  })
})

describe('13 알림', () => {
  it('안 읽은 알림이 있으면 빨간 점이 보이고, 패널에는 최신순으로 나온다', async () => {
    renderAt('/groups')
    expect(screen.getByLabelText('읽지 않은 알림 있음')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: '알림 열기' }))
    const rows = within(screen.getByRole('dialog')).getAllByRole('button').filter((b) => b.textContent!.includes('님이'))
    expect(rows[0].textContent).toContain('테스트님이 [제주도 여행]에 내역을 추가했어요')
    expect(rows[1].textContent).toContain('이하준님이 [제주도 여행] 그룹에 참여했어요')
  })

  it('알림을 누르면 읽음 처리 → 패널 닫힘 → 해당 그룹 지출 탭으로 이동', async () => {
    renderAt('/groups')
    await userEvent.click(screen.getByRole('button', { name: '알림 열기' }))
    await userEvent.click(screen.getByText('테스트님이 [제주도 여행]에 내역을 추가했어요'))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(await screen.findByText('₩958,000')).toBeTruthy() // 그룹 헤더가 보임 = 08로 이동
    expect(useAppStore.getState().notifications.find((n) => n.id === 'n_2')!.read).toBe(true)
  })

  it('배경을 누르면 읽음 처리 없이 패널만 닫힌다', async () => {
    renderAt('/groups')
    await userEvent.click(screen.getByRole('button', { name: '알림 열기' }))
    await userEvent.click(screen.getByRole('dialog').parentElement!.parentElement!)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(useAppStore.getState().notifications.find((n) => n.id === 'n_2')!.read).toBe(false)
  })

  it('알림이 하나도 없으면 안내 문구', async () => {
    useAppStore.setState({ notifications: [] })
    renderAt('/groups')
    await userEvent.click(screen.getByRole('button', { name: '알림 열기' }))
    expect(text()).toContain('아직 도착한 알림이 없어요.')
    expect(screen.queryByLabelText('읽지 않은 알림 있음')).toBeNull()
  })
})
