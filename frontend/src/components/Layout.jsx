import { NavLink, Link } from 'react-router-dom'

export default function Layout({ isAuthenticated, onLogout, children }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-wrap">
          <Link to="/" className="brand">
            SideQuest
          </Link>
        </div>

        <nav className="main-nav" aria-label="Main navigation">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/games">Games</NavLink>
          <NavLink to="/rankings">Rankings</NavLink>
          {isAuthenticated && (
            <>
              <NavLink to="/profile">Profile</NavLink>
              <NavLink to="/wishlist">Wishlist</NavLink>
              <NavLink to="/backlog">Backlog</NavLink>
            </>
          )}
        </nav>

        <div className="nav-actions auth-actions">
          {isAuthenticated ? (
            <button type="button" className="secondary-button" onClick={onLogout}>
              Log out
            </button>
          ) : (
            <>
              <Link to="/register" className="primary-button">
                Join now
              </Link>
              <Link to="/login" className="secondary-button">
                Log in
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="page-shell">{children}</main>

      <footer className="site-footer">
        <div>
          <strong>SideQuest</strong>
          <span>Rate, review, and track every game you play.</span>
        </div>
        <div className="footer-links">
          <Link to="/games">Discover</Link>
          <Link to="/profile">Profile</Link>
          <Link to="/rankings">Rankings</Link>
        </div>
      </footer>
    </div>
  )
}
