import { render, screen } from '@testing-library/react'
import RatingForm from './RatingForm'
it('keeps legacy rating form imports safe without an API connection', () => {
  render(<RatingForm />)
  expect(screen.getByRole('button', { name: 'Submit review' })).toBeDisabled()
  expect(screen.getByRole('status')).toHaveTextContent('Drafts are not saved')
})
