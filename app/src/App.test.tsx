// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetMockData } from './api'
import App from './App'
import { useAppStore } from './store/appStore'

beforeEach(async () => {
  await resetMockData()
  useAppStore.setState({ status: 'idle', currentUserId: null, viewAsMemberId: null, usersById: {}, groups: [], notifications: [] })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('App 시작', () => {
  it('처음 데이터를 불러오지 못해도 빈 화면 대신 다시 시도 화면을 보여주고, 누르면 다시 불러온다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const original = useAppStore.getState().refresh
    useAppStore.setState({ refresh: vi.fn().mockRejectedValue(new Error('network')) })

    render(<App />)
    expect(await screen.findByText('불러오지 못했어요')).toBeTruthy()

    useAppStore.setState({ refresh: original })
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => expect(useAppStore.getState().status).toBe('ready'))
    expect(screen.queryByText('불러오지 못했어요')).toBeNull()
  })
})
