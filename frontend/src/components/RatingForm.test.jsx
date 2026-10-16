import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import RatingForm from './RatingForm'

describe('RatingForm', () => {
  it('renders a rating input and submit button', () => {
    render(<RatingForm />)
    expect(screen.getByLabelText(/your rating/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
  })

  it('submits the entered rating', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    render(<RatingForm />)

    fireEvent.change(screen.getByLabelText(/your rating/i), { target: { value: '4' } })
    await userEvent.click(screen.getByRole('button', { name: /submit/i }))

    expect(log).toHaveBeenCalledWith('Submitted rating:', 4)
    log.mockRestore()
  })
})
