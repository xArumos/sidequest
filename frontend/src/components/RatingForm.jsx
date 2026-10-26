import {useState} from "react";

function RatingForm() {
    const [rating, setRating] = useState('1');

    function handleSubmit(e){
        e.preventDefault();
        console.log("Submitted rating:", Number(rating));
    }

    return (
        <form onSubmit={handleSubmit}>
            <label>
                Your Rating (1-5):
                <input
                    type="number"
                    required
                    min="1"
                    max="5"
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                />
            </label>
            <button type="submit">Submit</button>
        </form>
    )
}
export default RatingForm;