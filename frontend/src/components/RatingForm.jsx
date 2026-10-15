import {useState} from "react";

function RatingForm() {
    const [rating, setRating] = useState(0);

    function handleSubmit(e){
        e.preventDefault();
        console.log("Submitted rating:", rating);
    }

    return (
        <form onSubmit={handleSubmit}>
            <label>
                Your Rating (1-5):
                <input
                    type="number"
                    min="1"
                    max="5"
                    value={rating}
                    onChange={(e) => setRating(parseInt(e.target.value))}
                />
            </label>
            <button type="submit">Submit</button>
        </form>
    )
}
export default RatingForm;