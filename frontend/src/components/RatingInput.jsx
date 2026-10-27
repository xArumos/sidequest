export default function RatingInput({ value, onChange, disabled = false }) {
  return (
    <div role="group" className="rating-input" aria-label="Choose a rating">
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          disabled={disabled}
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
