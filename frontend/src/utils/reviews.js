export function validateReview({ rating, text }) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return 'Choose a rating from 1 to 5 before submitting.'
  }
  if (typeof text !== 'string' || text.trim().length > 2000) {
    return 'Reviews must be 2,000 characters or fewer.'
  }
  return ''
}
