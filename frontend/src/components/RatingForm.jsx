import ReviewForm from './ReviewForm'

// Retain the original import boundary without the old console-only submission.
export default function RatingForm(props) {
  return <ReviewForm {...props} />
}
