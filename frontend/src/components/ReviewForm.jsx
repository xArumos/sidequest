export default function ReviewForm({ onSubmit }) {
  return (
    <form className="review-form" onSubmit={onSubmit}>
      <label>
        Review title
        <input type="text" name="title" placeholder="What stood out to you?" required />
      </label>
      <label>
        Your review
        <textarea name="text" rows="5" placeholder="Tell the community what you loved or disliked." required />
      </label>
      <button type="submit" className="primary-button">Submit review</button>
    </form>
  )
}
