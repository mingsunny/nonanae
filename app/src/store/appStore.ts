import { create } from 'zustand'
import * as api from '../api'
import type {
  ExpenseInput,
  ExpenseWithParticipants,
  Group,
  GroupDetail,
  Member,
  Notification,
  User,
} from '../domain/types'

interface AppState {
  status: 'idle' | 'loading' | 'ready'
  /** 로그인한 정식 회원. 로그인 안 했으면 null */
  currentUserId: string | null
  /**
   * 로그아웃/탈퇴로 currentUserId가 null이 되는 것과 같은 타이밍에 함께 켜진다.
   * RequireUser가 "로그인 안 됨"으로 리다이렉트할 때 인트로 대신 로그인 화면으로 보내게 하는 신호 —
   * 처음부터 로그인 안 된 상태(새로고침, 직접 URL 진입)와 구분하기 위함. signIn/signUp에서 새 세션을 시작할 때 끈다.
   */
  leavingToLogin: boolean
  /** 로그인 없이 초대코드로 참여한 게스트가 지금 보고 있는 Member.id */
  viewAsMemberId: string | null
  usersById: Record<string, User>
  /** 내가 속한 그룹들 */
  groups: GroupDetail[]
  /** 내가 속한 그룹들의 알림, 최신순 */
  notifications: Notification[]

  /** 앱 시작 시 한 번 호출해 데이터를 불러옴 */
  init: () => Promise<void>
  /** 서버(지금은 목업)의 최신 상태로 다시 불러옴. 아래 액션들은 변경 후 자동으로 호출함 */
  refresh: () => Promise<void>

  addExpense: (input: ExpenseInput) => Promise<ExpenseWithParticipants>
  editExpense: (expenseId: string, input: ExpenseInput) => Promise<ExpenseWithParticipants>
  removeExpense: (expenseId: string) => Promise<void>
  addPendingMember: (groupId: string, name: string) => Promise<Member>
  /** 12: 게스트가 참여할 때 입력한 이름을 나중에 고침(본인 자리만) */
  renameGuestMember: (memberId: string, name: string) => Promise<void>
  markNotificationRead: (notificationId: string) => Promise<void>

  // 01/02/04: 로그인·가입·프로필
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: api.SignUpInput) => Promise<void>
  /** 로그아웃. 로그인 없이 참여한 게스트가 그룹 화면에서 나갈 때도 쓴다. */
  signOut: () => Promise<void>
  deleteAccount: () => Promise<void>
  updateProfile: (input: api.ProfileInput) => Promise<void>
  markGroupCreateCoachSeen: () => Promise<void>

  // 05: 그룹 생성
  createGroup: (name: string) => Promise<Group>

  // 06/07: 초대코드로 참여. 그룹 안으로 들어가는 결과가 나오면 그 그룹이 스토어에 들어 있도록 refresh까지 마친다.
  resolveInviteCode: (raw: string) => Promise<api.JoinResolution>
  joinAsExistingMember: (groupId: string, memberId: string) => Promise<void>
  joinAsNewGuest: (groupId: string, name: string) => Promise<void>
  joinAsNewAccountMember: (groupId: string) => Promise<void>
}

export const useAppStore = create<AppState>()((set, get) => ({
  status: 'idle',
  currentUserId: null,
  leavingToLogin: false,
  viewAsMemberId: null,
  usersById: {},
  groups: [],
  notifications: [],

  init: async () => {
    if (get().status !== 'idle') return
    set({ status: 'loading' })
    await get().refresh()
  },

  refresh: async () => {
    const snapshot = await api.fetchSnapshot()
    set({
      status: 'ready',
      currentUserId: snapshot.session.userId,
      viewAsMemberId: snapshot.session.viewAsMemberId,
      usersById: Object.fromEntries(snapshot.users.map((u) => [u.id, u])),
      groups: snapshot.groups,
      notifications: snapshot.notifications,
    })
  },

  addExpense: async (input) => {
    const expense = await api.createExpense(input)
    await get().refresh()
    return expense
  },

  editExpense: async (expenseId, input) => {
    const expense = await api.updateExpense(expenseId, input)
    await get().refresh()
    return expense
  },

  removeExpense: async (expenseId) => {
    await api.deleteExpense(expenseId)
    await get().refresh()
  },

  addPendingMember: async (groupId, name) => {
    const member = await api.addPendingMember(groupId, name)
    await get().refresh()
    return member
  },

  renameGuestMember: async (memberId, name) => {
    await api.renameGuestMember(memberId, name)
    await get().refresh()
  },

  markNotificationRead: async (notificationId) => {
    await api.markNotificationRead(notificationId)
    await get().refresh()
  },

  signIn: async (email, password) => {
    await api.signIn(email, password)
    set({ leavingToLogin: false })
    await get().refresh()
  },

  signUp: async (input) => {
    await api.signUp(input)
    set({ leavingToLogin: false })
    await get().refresh()
  },

  signOut: async () => {
    // 게스트가 그룹에서 나갈 때도 이 액션을 쓰는데, 그때는 RequireUser를 거치지 않고 이미 인트로로
    // 직접 이동하므로 이 플래그가 필요 없다 — 로그인했던 정식 회원이 나갈 때만 켠다.
    if (get().currentUserId !== null) set({ leavingToLogin: true })
    await api.signOut()
    await get().refresh()
  },

  deleteAccount: async () => {
    set({ leavingToLogin: true })
    await api.deleteAccount()
    await get().refresh()
  },

  updateProfile: async (input) => {
    await api.updateProfile(input)
    await get().refresh()
  },

  markGroupCreateCoachSeen: async () => {
    await api.markGroupCreateCoachSeen()
    await get().refresh()
  },

  createGroup: async (name) => {
    const group = await api.createGroup(name)
    await get().refresh()
    return group
  },

  resolveInviteCode: async (raw) => {
    const resolution = await api.resolveInviteCode(raw)
    // 개인 초대 링크로 바로 연결된 경우 데이터가 바뀌었으므로 다시 불러옴 (재입장은 바뀐 게 없어도 무해)
    if (resolution.kind === 'joined') await get().refresh()
    return resolution
  },

  joinAsExistingMember: async (groupId, memberId) => {
    await api.joinAsExistingMember(groupId, memberId)
    await get().refresh()
  },

  joinAsNewGuest: async (groupId, name) => {
    await api.joinAsNewGuest(groupId, name)
    await get().refresh()
  },

  joinAsNewAccountMember: async (groupId) => {
    await api.joinAsNewAccountMember(groupId)
    await get().refresh()
  },
}))

// --- 셀렉터: useAppStore(selectGroup(groupId)) 처럼 사용 ---

export const selectGroup = (groupId: string | undefined) => (s: AppState) =>
  s.groups.find((g) => g.id === groupId)

export const selectHasUnreadNotifications = (s: AppState) => s.notifications.some((n) => !n.read)
