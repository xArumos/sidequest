import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import Layout from './Layout'
it('[TC-FE-NAV-01] gives keyboard users a skip link targeting the main landmark', async () => {
  render(<MemoryRouter><Layout><h1>Synthetic page</h1></Layout></MemoryRouter>)
  await userEvent.tab()
  expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveFocus()
  expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
  expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main-content')
})
it('[TC-FE-NAV-02] exposes private navigation only for a signed-in account', () => {
  const view = render(<MemoryRouter><Layout isAuthenticated={false} /></MemoryRouter>)
  const nav = () => within(screen.getByRole('navigation', { name: 'Main navigation' }))
  expect(nav().queryByRole('link', { name: 'Wishlist' })).not.toBeInTheDocument()
  view.rerender(<MemoryRouter><Layout isAuthenticated /></MemoryRouter>)
  for (const name of ['Profile', 'Wishlist', 'Backlog']) expect(nav().getByRole('link', { name })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Join now' })).not.toBeInTheDocument()
})
it('[TC-FE-NAV-03] marks the current discovery route for assistive technology', () => {
  render(<MemoryRouter initialEntries={['/games']}><Layout /></MemoryRouter>)
  const nav = within(screen.getByRole('navigation', { name: 'Main navigation' }))
  expect(nav.getByRole('link', { name: 'Games' })).toHaveAttribute('aria-current', 'page')
  expect(nav.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
})
it('[TC-FE-NAV-04] disables repeated logout while a request is pending', async () => {
  const logout = vi.fn()
  const view = render(<MemoryRouter><Layout isAuthenticated busy onLogout={logout} /></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: 'Log out' }))
  expect(logout).not.toHaveBeenCalled()
  view.rerender(<MemoryRouter><Layout isAuthenticated busy={false} onLogout={logout} /></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: 'Log out' }))
  expect(logout).toHaveBeenCalledTimes(1)
})
