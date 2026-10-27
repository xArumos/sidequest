import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import RatingInput from './RatingInput'
it('[TC-RATE-02] offers only integer ratings 1 through 5 with selected feedback', async () => {
  const change = vi.fn()
  const view = render(<RatingInput value={0} onChange={change} />)
  expect(screen.getAllByRole('button')).toHaveLength(5)
  for (const rating of [1, 2, 3, 4, 5]) {
    await userEvent.click(screen.getByRole('button', { name: `Rate ${rating} stars` }))
    expect(change).toHaveBeenLastCalledWith(rating)
    view.rerender(<RatingInput value={rating} onChange={change} />)
    expect(screen.getByRole('button', { name: `Rate ${rating} stars` })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('button').filter(button => button.getAttribute('aria-pressed') === 'true')).toHaveLength(1)
  }
})
it('[TC-FE-RATE-01] selects a star with keyboard focus and Enter', async () => {
  const change = vi.fn()
  render(<RatingInput value={0} onChange={change} />)
  await userEvent.tab()
  expect(screen.getByRole('button', { name: 'Rate 1 stars' })).toHaveFocus()
  await userEvent.keyboard('{Enter}')
  expect(change).toHaveBeenCalledWith(1)
})
it('[TC-FE-RATE-02] blocks rating changes while disabled', async () => {
  const change = vi.fn()
  render(<RatingInput disabled value={2} onChange={change} />)
  await userEvent.click(screen.getByRole('button', { name: 'Rate 5 stars' }))
  expect(screen.getAllByRole('button').every(button => button.disabled)).toBe(true)
  expect(change).not.toHaveBeenCalled()
})
