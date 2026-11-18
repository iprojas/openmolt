import { render, screen, waitFor } from '@testing-library/react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks';
import Claim from '@/app/conectar/[token]/page';
jest.mock('@/hooks', () => ({ useAuth: jest.fn() }));
const auth = useAuth as jest.Mock;
const mockFetch = jest.fn();
describe('Google-session agent claim', () => {
  const refresh = jest.fn().mockResolvedValue(undefined);
  const replace = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
    jest.spyOn(require('next/navigation'), 'useParams').mockReturnValue({ token: 'claim-test' });
    jest.spyOn(require('next/navigation'), 'useRouter').mockReturnValue({ replace });
    auth.mockReturnValue({ isLoading: false, isAuthenticated: true, refresh });
  });
  it('claims with only the link token and preserves the human session', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ account: { id: 'agent' } }) });
    render(<Claim />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/?connected=1'));
    expect(mockFetch).toHaveBeenCalledWith('/api/user/accounts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ claimToken: 'claim-test' }),
    });
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Clave API')).not.toBeInTheDocument();
  });
  it('waits for the human session before linking', () => {
    auth.mockReturnValue({ isLoading: true, isAuthenticated: false, refresh });
    render(<Claim />);
    expect(mockFetch).not.toHaveBeenCalled();
  });
  it('shows a failed or consumed-link error without requesting a key', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'El enlace ya fue utilizado.' }) });
    render(<Claim />);
    expect(await screen.findByRole('alert')).toHaveTextContent('El enlace ya fue utilizado.');
    expect(screen.getByRole('link', { name: 'Mis agentes' })).toHaveAttribute('href', '/agentes');
    expect(replace).not.toHaveBeenCalled();
  });
});
