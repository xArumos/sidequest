import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GoogleSignIn from './GoogleSignIn';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const response = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

describe('Google account integration', () => {
  it('posts the Google credential with cookies and shows the verified user', async () => {
    let callback;
    const renderButton = vi.fn();
    vi.stubGlobal('google', { accounts: { id: {
      initialize: vi.fn(options => { callback = options.callback; }), renderButton,
    } } });
    const request = vi.fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200, { user: { displayName: 'Player' } }));
    vi.stubGlobal('fetch', request);
    render(<GoogleSignIn clientId="test-client" />);
    await waitFor(() => expect(renderButton).toHaveBeenCalled());
    await callback({ credential: 'google-token' });
    expect(await screen.findByText('Signed in as Player')).toBeInTheDocument();
    expect(request).toHaveBeenLastCalledWith('http://localhost:5000/api/auth/google', expect.objectContaining({
      method: 'POST', credentials: 'include', body: JSON.stringify({ credential: 'google-token' }),
    }));
  });

  it('restores a saved session and preserves it when logout fails', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(response(200, { user: { displayName: 'Returning player' } }))
      .mockResolvedValueOnce(response(500));
    vi.stubGlobal('fetch', request);
    render(<GoogleSignIn />);
    expect(await screen.findByText('Signed in as Returning player')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign out');
    expect(screen.getByText('Signed in as Returning player')).toBeInTheDocument();
  });

  it('ends the session and offers sign-in again after logout', async () => {
    const renderButton = vi.fn();
    const disableAutoSelect = vi.fn();
    vi.stubGlobal('google', { accounts: { id: { initialize: vi.fn(), renderButton, disableAutoSelect } } });
    const request = vi.fn()
      .mockResolvedValueOnce(response(200, { user: { displayName: 'Player' } }))
      .mockResolvedValueOnce(response(204))
      .mockResolvedValueOnce(response(401));
    vi.stubGlobal('fetch', request);
    render(<GoogleSignIn clientId="test-client" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(renderButton).toHaveBeenCalled());
    expect(disableAutoSelect).toHaveBeenCalled();
    expect(screen.queryByText('Signed in as Player')).not.toBeInTheDocument();
    expect(request).toHaveBeenCalledWith('http://localhost:5000/api/auth/logout', { method: 'POST', credentials: 'include' });
  });

  it('does not offer login when the server disables authentication', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(503)));
    render(<GoogleSignIn clientId="test-client" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('not configured on the server');
  });

  it('shows credential rejection instead of a signed-in user', async () => {
    let callback;
    vi.stubGlobal('google', { accounts: { id: {
      initialize: options => { callback = options.callback; }, renderButton: vi.fn(),
    } } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(401, { error: { message: 'Google sign-in could not be verified.' } })));
    render(<GoogleSignIn clientId="test-client" />);
    await waitFor(() => expect(callback).toBeTypeOf('function'));
    await callback({ credential: 'invalid-token' });
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be verified');
    expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument();
  });
});
