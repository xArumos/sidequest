import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import ReviewForm from './ReviewForm'
it('allows local drafting but disables publishing without a real integration', async () => {
  const save = vi.fn()
  render(<ReviewForm onSubmit={save} />)
  await userEvent.click(screen.getByRole('button', { name: 'Rate 4 stars' }))
  expect(screen.getByRole('button', { name: 'Rate 4 stars' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.type(screen.getByRole('textbox'), 'Draft')
  expect(screen.getByRole('button', { name: 'Submit review' })).toBeDisabled()
  expect(screen.getByRole('status')).toHaveTextContent('Drafts are not saved')
  expect(save).not.toHaveBeenCalled()
})
it('validates a rating and keeps a failed draft for retry', async () => {
  const save = vi.fn().mockRejectedValue(new Error('Service unavailable'))
  render(<ReviewForm available onSubmit={save} />)
  await userEvent.click(screen.getByRole('button', { name: 'Submit review' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Choose a rating')
  expect(save).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Rate 5 stars' }))
  await userEvent.type(screen.getByRole('textbox'), '  Loved it  ')
  await userEvent.click(screen.getByRole('button', { name: 'Submit review' }))
  expect(save).toHaveBeenCalledWith({ rating: 5, text: 'Loved it' })
  expect(screen.getByRole('alert')).toHaveTextContent('Service unavailable')
  expect(screen.getByRole('textbox')).toHaveValue('  Loved it  ')
  expect(screen.queryByText('Review saved.')).not.toBeInTheDocument()
})
it('shows confirmation only after persistence resolves', async () => {
  let resolve
  const save = vi.fn().mockReturnValue(new Promise(done => { resolve = done }))
  render(<ReviewForm available onSubmit={save} />)
  await userEvent.click(screen.getByRole('button', { name: 'Rate 3 stars' }))
  await userEvent.click(screen.getByRole('button', { name: 'Submit review' }))
  expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  expect(screen.queryByText('Review saved.')).not.toBeInTheDocument()
  resolve()
  expect(await screen.findByText('Review saved.')).toBeInTheDocument()
})
