import AuthPanel from './components/AuthPanel'
import RatingForm from './components/RatingForm'
import './App.css'

function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">Your games. Your stories.</p>
        <h1>SideQuest</h1>
        <p>Keep track of the games that stay with you.</p>
      </header>
      <AuthPanel />
      <section className="rating-section" aria-labelledby="rating-title">
        <h2 id="rating-title">Rate a game</h2>
        <RatingForm />
      </section>
    </main>
  )
}

export default App
