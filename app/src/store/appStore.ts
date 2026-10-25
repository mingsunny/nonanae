import { create } from 'zustand'
import * as api from '../api'
import type {
  ExpenseInput,
  ExpenseWithParticipants,
  Group,
  GroupDetail,
  JoinRequest,
  Member,
  Notification,
  User,
} from '../domain/types'

interface AppState {
  /** error: 처음 데이터를 불러오지 못한 상태 — 빈 화면으로 멈추지 않고 App이 다시 시도 화면을 보여준다 */
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** 로그인한 정식 회원. 로그인 안 했으면 null */
  currentUserId: string | null
  /**
   * 로그아웃/탈퇴로 currentUserId가 null이 되는 것과 같은 타이밍에 함께 켜진다.
   * RequireUser가 "로그인 안 됨"으로 리다이렉트할 때 인트로 대신 로그인 화면으로 보내게 하는 신호 —
   * 처음부터 로그인 안 된 상태(새로고침, 직접 URL 진입)와 구분하기 위함. signIn/signUp에서 새 세션을 시작할 때 끈다.
   */
  leavingToLogin: boolean
  /**
   * 로그인은 됐지만 이름·계좌(프로필)를 아직 등록하지 않음 — 가입 확인 메일을 눌러 들어온 직후 등.
   * 이 동안은 currentUserId가 null이고, 화면은 계좌 등록(`/signup/account`)으로 보낸다.
   */
  needsProfile: boolean
  /** 로그인 없이 초대코드로 참여한 게스트가 지금 보고 있는 Member.id */
  viewAsMemberId: string | null
  usersById: Record<string, User>
  /** 내가 속한 그룹들 */
  groups: GroupDetail[]
  /** 내가 속한 그룹들의 알림, 최신순 */
  notifications: Notification[]
  /** 내가 보낸 참여 요청(mine) + 내가 방장인 그룹에 들어온 참여 요청 */
  joinRequests: JoinRequest[]

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
  /** 회원가입 1단계(이메일·비밀번호). 이메일 확인이 필요하면 SignUpConfirmationRequired로 던진다. */
  signUp: (input: api.SignUpInput) => Promise<void>
  /** 이메일 확인 뒤 이름·은행·계좌를 처음 등록 (02) */
  completeProfile: (input: api.ProfileInput) => Promise<void>
  /** 로그아웃. 로그인 없이 참여한 게스트가 그룹 화면에서 나갈 때도 쓴다. */
  signOut: () => Promise<void>
  deleteAccount: () => Promise<void>
  updateProfile: (input: api.ProfileInput) => Promise<void>
  markGroupCreateCoachSeen: () => Promise<void>

  // 05: 그룹 생성
  createGroup: (name: string) => Promise<Group>
  /** 12: 초대코드 재발급(방장 전용). 새 코드를 돌려주고, 이전 코드는 즉시 못 쓴다. */
  rotateInviteCode: (groupId: string) => Promise<string>

  // 06/07: 초대코드로 참여. 참여는 요청만 남기고 방장이 승인해야 멤버가 된다.
  // 그룹 안으로 들어가는 결과가 나오면 그 그룹이 스토어에 들어 있도록 refresh까지 마친다.
  resolveInviteCode: (raw: string) => Promise<api.JoinResolution>
  joinAsExistingMember: (groupId: string, memberId: string) => Promise<void>
  joinAsNewGuest: (groupId: string, name: string) => Promise<void>
  joinAsNewAccountMember: (groupId: string) => Promise<void>
  /** 승인 대기 화면이 확인: 승인됐으면(joined) 그 그룹이 스토어에 들어 있도록 refresh까지 마친다 */
  checkJoinRequest: (groupId: string) => Promise<api.JoinRequestStatus>
  cancelJoinRequest: (groupId: string) => Promise<void>
  /** 12: 방장이 참여 요청을 승인/거절 */
  approveJoinRequest: (requestId: string) => Promise<void>
  rejectJoinRequest: (requestId: string) => Promise<void>
}

export const useAppStore = create<AppState>()((set, get) => ({
  status: 'idle',
  currentUserId: null,
  leavingToLogin: false,
  needsProfile: false,
  viewAsMemberId: null,
  usersById: {},
  groups: [],
  notifications: [],
  joinRequests: [],

  init: async () => {
    if (get().status !== 'idle' && get().status !== 'error') return
    set({ status: 'loading' })
    try {
      await get().refresh()
    } catch (err) {
      console.error('[app] 처음 데이터를 불러오지 못했어요', err)
      set({ status: 'error' })
    }
  },

  refresh: async () => {
    const snapshot = await api.fetchSnapshot()
    set({
      status: 'ready',
      currentUserId: snapshot.session.userId,
      needsProfile: snapshot.session.needsProfile === true,
      viewAsMemberId: snapshot.session.viewAsMemberId,
      usersById: Object.fromEntries(snapshot.users.map((u) => [u.id, u])),
      groups: snapshot.groups,
      notifications: snapshot.notifications,
      joinRequests: snapshot.joinRequests,
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
    // 이름·계좌 등록을 마치지 않은 계정이면 아래 refresh가 needsProfile을 켜서 화면이 계좌 등록으로 보낸다
    await api.signIn(email, password)
    set({ leavingToLogin: false })
    await get().refresh()
  },

  signUp: async (input) => {
    await api.signUp(input)
    set({ leavingToLogin: false })
    await get().refresh()
  },

  completeProfile: async (input) => {
    await api.completeProfile(input)
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

  rotateInviteCode: async (groupId) => {
    const code = await api.rotateInviteCode(groupId)
    await get().refresh()
    return code
  },

  resolveInviteCode: async (raw) => {
    const resolution = await api.resolveInviteCode(raw)
    // 재입장(승인 뒤 처음 들어오는 경우 포함)이면 그 그룹을, 요청을 기다리는 중이면 내 요청을 다시 불러옴
    if (resolution.kind === 'joined' || resolution.kind === 'requested') await get().refresh()
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

  checkJoinRequest: async (groupId) => {
    const status = await api.checkJoinRequest(groupId)
    if (status === 'joined') await get().refresh()
    return status
  },

  cancelJoinRequest: async (groupId) => {
    await api.cancelJoinRequest(groupId)
    await get().refresh()
  },

  approveJoinRequest: async (requestId) => {
    await api.approveJoinRequest(requestId)
    await get().refresh()
  },

  rejectJoinRequest: async (requestId) => {
    await api.rejectJoinRequest(requestId)
    await get().refresh()
  },
}))

// --- 셀렉터: useAppStore(selectGroup(groupId)) 처럼 사용 ---

export const selectGroup = (groupId: string | undefined) => (s: AppState) =>
  s.groups.find((g) => g.id === groupId)

export const selectHasUnreadNotifications = (s: AppState) => s.notifications.some((n) => !n.read)
