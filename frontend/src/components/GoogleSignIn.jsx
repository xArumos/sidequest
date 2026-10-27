import { useEffect, useRef, useState } from 'react';

let sdkPromise;
function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => window.google?.accounts?.id
        ? resolve(window.google)
        : reject(new Error('Google sign-in did not load. Please refresh.'));
      script.onerror = () => reject(new Error('Cannot load Google sign-in. Please refresh.'));
      document.head.appendChild(script);
    }).catch(error => {
      sdkPromise = undefined;
      throw error;
    });
  }
  return sdkPromise;
}

const apiOrigin = (import.meta.env.VITE_API_ORIGIN || 'http://localhost:5000').replace(/\/$/, '');

// Mount one instance. The backend verifies the credential and creates the session.
export default function GoogleSignIn({ clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID }) {
  const button = useRef(null);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('Checking session…');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function start() {
      try {
        const response = await fetch(`${apiOrigin}/api/auth/me`, {
          credentials: 'include', signal: controller.signal,
        });
        if (!active) return;
        if (response.ok) {
          const result = await response.json();
          if (active) { setUser(result.user); setStatus(''); }
          return;
        }
        if (response.status === 503) throw new Error('Google sign-in is not configured on the server.');
        if (response.status !== 401) throw new Error('Cannot check your session. Please refresh.');
        if (!clientId) throw new Error('Set VITE_GOOGLE_CLIENT_ID to enable Google sign-in.');
        const google = await loadGoogle();
        if (!active) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: async ({ credential }) => {
            if (!active) return;
            setError('');
            setStatus('Signing in…');
            try {
              const login = await fetch(`${apiOrigin}/api/auth/google`, {
                method: 'POST', credentials: 'include', signal: controller.signal,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential }),
              });
              const result = await login.json();
              if (!login.ok) throw new Error(result.error?.message || 'Sign-in failed.');
              if (active) setUser(result.user);
            } catch (err) {
              if (active) setError(err.message || 'Cannot reach the sign-in server.');
            } finally {
              if (active) setStatus('');
            }
          },
        });
        google.accounts.id.renderButton(button.current, { theme: 'outline', size: 'large' });
        setStatus('');
      } catch (err) {
        if (active) { setError(err.message); setStatus(''); }
      }
    }
    start();
    const container = button.current;
    return () => {
      active = false;
      controller.abort();
      container?.replaceChildren();
    };
  }, [attempt, clientId]);

  async function logout() {
    setLoggingOut(true);
    setError('');
    try {
      const response = await fetch(`${apiOrigin}/api/auth/logout`, {
        method: 'POST', credentials: 'include',
      });
      if (!response.ok) throw new Error('Could not sign out. Please try again.');
      window.google?.accounts?.id?.disableAutoSelect();
      setUser(null);
      setStatus('Loading sign-in…');
      setAttempt(value => value + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <section aria-label="Account sign-in">
      <div ref={button} hidden={Boolean(user)} />
      {user && <div>
        <p>Signed in as {user.displayName}</p>
        <button type="button" onClick={logout} disabled={loggingOut}>
          {loggingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>}
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
      {error && !user && <button type="button" onClick={() => {
        setError('');
        setStatus('Checking session…');
        setAttempt(value => value + 1);
      }}>Retry</button>}
    </section>
  );
}
