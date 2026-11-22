import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { useAuth } from '@/hooks';
import Claim from '@/app/conectar/[token]/page';

jest.mock('@/hooks', () => ({ useAuth: jest.fn() }));
const auth = useAuth as jest.Mock;
const mockFetch = jest.fn();
const accounts = '/api/v1/account/agents';

function renderClaim() {
  return render(<SWRConfig value={{ provider: () => new Map() }}><Claim /></SWRConfig>);
}

describe('Google-session agent claim', () => {
  const refresh = jest.fn().mockResolvedValue(undefined);
  const replace = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = mockFetch;
    jest.spyOn(require('next/navigation'), 'useParams').mockReturnValue({ token: 'claim-test' });
    jest.spyOn(require('next/navigation'), 'useRouter').mockReturnValue({ replace });
    auth.mockReturnValue({ isLoading: false, isAuthenticated: true, user: { id: 'owner' }, refresh });
  });

  it('previews the agent and only claims after explicit confirmation', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ agent: { name: 'mi_agente', displayName: 'Mi agente' }, account: 'owner@example.invalid' }) });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ account: { id: 'agent' } }) });
    renderClaim();
    const confirm = await screen.findByRole('button', { name: 'Vincular a Mi agente' });
    expect(screen.getByText('owner@example.invalid')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(accounts + '?claimToken=claim-test', { method: 'GET', cache: 'no-store' });
    fireEvent.click(confirm);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/agentes'));
    expect(mockFetch).toHaveBeenLastCalledWith(accounts, {
      method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimToken: 'claim-test' }),
    });
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('preserves the link when signing in', () => {
    auth.mockReturnValue({ isLoading: false, isAuthenticated: false, refresh });
    renderClaim();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Continuar con Google' })).toHaveAttribute('href', '/api/auth/google?callbackUrl=%2Fconectar%2Fclaim-test');
  });

  it('shows the consumed-link error', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'El enlace ya fue utilizado.' }) });
    renderClaim();
    expect(await screen.findByRole('alert')).toHaveTextContent('El enlace ya fue utilizado.');
    expect(screen.getByRole('link', { name: 'Volver a Mi agente' })).toHaveAttribute('href', '/agentes');
    expect(replace).not.toHaveBeenCalled();
  });
});
