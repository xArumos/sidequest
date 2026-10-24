import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

describe('SideQuest app', () => {
  it('renders the landing page and homepage auth actions', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /^SideQuest$/i })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /^Join now$/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /^Log in$/i }).length).toBeGreaterThan(0)
  })

  it('shows the login screen on the auth route', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /sign in to continue/i })).toBeInTheDocument()
  })
})
