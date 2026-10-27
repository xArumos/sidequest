import { expect, it } from 'vitest'
import { validateReview } from './reviews'
it('[TC-FE-RATE-09] rejects out-of-range fractional and nonnumeric ratings before persistence', () => {
  for (const rating of [-1, 0, 6, 5.4, NaN, Infinity, '3', undefined]) {
    expect(validateReview({ rating, text: 'Synthetic review' })).toMatch(/choose a rating/i)
  }
  for (const rating of [1, 2, 3, 4, 5]) {
    expect(validateReview({ rating, text: '' })).toBe('')
  }
})
it('[TC-FE-RATE-10] checks text boundaries after trimming without requiring review text', () => {
  expect(validateReview({ rating: 3, text: 'x'.repeat(2000) })).toBe('')
  expect(validateReview({ rating: 3, text: 'x'.repeat(2001) })).toMatch(/2,000/)
  expect(validateReview({ rating: 3, text: '   ' })).toBe('')
  expect(validateReview({ rating: 3, text: undefined })).toMatch(/2,000/)
})
