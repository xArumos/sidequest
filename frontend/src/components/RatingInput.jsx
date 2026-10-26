export default function RatingInput({ value, onChange }) {
  return (
    <div className="rating-input" aria-label="Choose a rating">
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          className={rating <= value ? 'star selected' : 'star'}
          onClick={() => onChange(rating)}
          aria-label={`Rate ${rating} stars`}
          aria-pressed={rating === value}
        >
          ★
        </button>
      ))}
    </div>
  )
}
