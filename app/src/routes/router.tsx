import { createBrowserRouter, Navigate } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import GroupLayout from '../layouts/GroupLayout'
import HomeLayout from '../layouts/HomeLayout'
import CreateGroupPage from '../pages/CreateGroupPage'
import ExpenseFormPage from '../pages/ExpenseFormPage'
import ExpenseListPage from '../pages/ExpenseListPage'
import GroupListPage from '../pages/GroupListPage'
import JoinPage from '../pages/JoinPage'
import LoginPage from '../pages/LoginPage'
import MemberInvitePage from '../pages/MemberInvitePage'
import NotFoundPage from '../pages/NotFoundPage'
import PasswordResetPage from '../pages/PasswordResetPage'
import ProfilePage from '../pages/ProfilePage'
import SettlePage from '../pages/SettlePage'
import SummaryPage from '../pages/SummaryPage'
import RequireUser from './RequireUser'
import { paths } from './paths'

// 경로 표: docs/spec/conventions.md "URL 경로 (라우팅)"
// 정적 경로(/groups/new, .../expenses/new)는 동적 경로(:groupId, :expenseId)보다 자동으로 우선 매칭됨.
export const routes: RouteObject[] = [
  { path: '/', element: <Navigate to={paths.groups} replace /> },

  // 01·02: 인트로/로그인/회원가입은 한 경로 안의 단계, 06·07: 초대코드 참여도 한 경로 안의 단계
  { path: 'login', element: <LoginPage /> },
  { path: 'join', element: <JoinPage /> },
  { path: 'password-reset', element: <PasswordResetPage /> },

  // 03~05: 정식 회원 전용. 03/04는 인사말+알림 종과 하단 홈/프로필 탭바를 공유
  {
    element: <RequireUser />,
    children: [
      {
        element: <HomeLayout />,
        children: [
          { path: 'groups', element: <GroupListPage /> },
          { path: 'profile', element: <ProfilePage /> },
        ],
      },
      { path: 'groups/new', element: <CreateGroupPage /> },
    ],
  },

  // 08~10: 공용 헤더 + 하단 탭바
  {
    path: 'groups/:groupId',
    element: <GroupLayout />,
    children: [
      { index: true, element: <Navigate to="expenses" replace /> },
      { path: 'expenses', element: <ExpenseListPage /> },
      { path: 'settle', element: <SettlePage /> },
      { path: 'summary', element: <SummaryPage /> },
    ],
  },

  // 11, 12: 탭바 없는 전체 화면
  { path: 'groups/:groupId/expenses/new', element: <ExpenseFormPage /> },
  { path: 'groups/:groupId/expenses/:expenseId', element: <ExpenseFormPage /> },
  { path: 'groups/:groupId/members', element: <MemberInvitePage /> },

  { path: '*', element: <NotFoundPage /> },
]

export const router = createBrowserRouter(routes)
