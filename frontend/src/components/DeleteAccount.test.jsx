import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import App from '../App'
import { auth, ApiError } from '../services/auth'
import { api } from '../services/api'

vi.mock('../services/auth', async importOriginal => ({
  ...await importOriginal(), auth: { me: vi.fn(), login: vi.fn(), logout: vi.fn() },
}))
vi.mock('../services/api', async () => ({ api: (await import('../test/apiMock')).createApiMock() }))
vi.mock('./GoogleSignIn', () => ({ default: () => <button type="button">Continue with Google</button> }))

const passwordUser = {
  id: 'user-1', displayName: 'Synthetic Player', username: 'synthetic', email: 'player@example.test',
  avatarUrl: '', authMethod: 'password',
}
const googleUser = { ...passwordUser, username: null, authMethod: 'google' }

function visitEditProfile(user) {
  auth.me.mockResolvedValue(user)
  render(<MemoryRouter initialEntries={['/profile/edit']}><App /></MemoryRouter>)
}

async function openDialog() {
  const trigger = await screen.findByRole('button', { name: 'Delete account…' })
  await userEvent.click(trigger)
  return { trigger, dialog: screen.getByRole('dialog', { name: 'Delete your account?' }) }
}

beforeEach(() => {
  vi.resetAllMocks()
})

it('[TC-FE-DEL-01] deletes a password account and returns home signed out', async () => {
  visitEditProfile(passwordUser)
  const { dialog } = await openDialog()
  const password = within(dialog).getByLabelText('Password')
  expect(password).toHaveFocus()
  expect(password).toHaveAttribute('type', 'password')
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(dialog).toHaveAccessibleDescription(/cannot be undone/i)

  await userEvent.type(password, 'my password')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete account' }))

  expect(api.deleteAccount).toHaveBeenCalledWith({ password: 'my password' })
  expect(await screen.findByRole('heading', { name: /rate, review, and track/i })).toBeInTheDocument()
  expect(screen.getByText('Your account and its data have been deleted.')).toHaveAttribute('role', 'status')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: /^log in$/i }).length).toBeGreaterThan(0)
})

it('[TC-FE-DEL-02] asks a Google account to type its email', async () => {
  visitEditProfile(googleUser)
  const { dialog } = await openDialog()
  const confirm = within(dialog).getByLabelText(`Type ${googleUser.email} to confirm`)
  expect(confirm).toHaveAttribute('type', 'text')
  await userEvent.type(confirm, googleUser.email)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete account' }))
  expect(api.deleteAccount).toHaveBeenCalledWith({ confirm: googleUser.email })
  expect(await screen.findByRole('heading', { name: /rate, review, and track/i })).toBeInTheDocument()
})

it('[TC-FE-DEL-03] shows server and empty-input errors and keeps the user signed in', async () => {
  api.deleteAccount.mockRejectedValue(new ApiError('That password is incorrect.', 403, 'INVALID_PASSWORD'))
  visitEditProfile(passwordUser)
  const { dialog } = await openDialog()
  const deleteButton = within(dialog).getByRole('button', { name: 'Delete account' })

  await userEvent.click(deleteButton)
  expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter your password.')
  expect(api.deleteAccount).not.toHaveBeenCalled()

  const password = within(dialog).getByLabelText('Password')
  await userEvent.type(password, 'wrong password')
  await userEvent.click(deleteButton)
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('That password is incorrect.')
  expect(password).toHaveAttribute('aria-invalid', 'true')
  expect(password).toHaveAccessibleDescription('That password is incorrect.')
  await waitFor(() => expect(password).toHaveFocus())
  expect(screen.getByRole('heading', { name: 'Edit profile' })).toBeInTheDocument()
})

it('[TC-FE-DEL-04] traps focus in the dialog, and Escape closes it and restores focus', async () => {
  visitEditProfile(passwordUser)
  const { dialog, trigger } = await openDialog()
  const password = within(dialog).getByLabelText('Password')
  const cancel = within(dialog).getByRole('button', { name: 'Cancel' })
  const confirm = within(dialog).getByRole('button', { name: 'Delete account' })

  await userEvent.tab()
  expect(cancel).toHaveFocus()
  await userEvent.tab()
  expect(confirm).toHaveFocus()
  await userEvent.tab()
  expect(password).toHaveFocus()
  await userEvent.tab({ shift: true })
  expect(confirm).toHaveFocus()

  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await waitFor(() => expect(trigger).toHaveFocus())
  expect(api.deleteAccount).not.toHaveBeenCalled()

  await userEvent.click(trigger)
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
