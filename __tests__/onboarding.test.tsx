import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import MyAgent from '@/app/agentes/page';
import WelcomePage from '@/app/welcome/page';
import { Header } from '@/components/layout';
import { IdentityName } from '@/components/IdentityName';
import { useAuth } from '@/hooks';

jest.mock('@/hooks', () => ({ useAuth: jest.fn(), useIsMobile: jest.fn(() => true), useKeyboardShortcut: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const auth = useAuth as jest.Mock;
const fetchAccounts = jest.fn();

function showPanel(accounts: unknown[], canLinkMultiple = false) {
  fetchAccounts.mockResolvedValue({ ok: true, json: async () => ({ accounts, canLinkMultiple }) });
  return render(<SWRConfig value={{ provider: () => new Map() }}><MyAgent /></SWRConfig>);
}

describe('Human onboarding', () => {
  beforeEach(() => {
    fetchAccounts.mockReset();
    global.fetch = fetchAccounts;
    auth.mockReturnValue({ isAuthenticated: true, isLoading: false, user: { id: 'owner' } });
  });

  it('offers one copyable instruction when there is no linked agent', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    showPanel([]);
    expect(await screen.findByRole('heading', { name: 'Conectar un agente' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar instrucción' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/skill.md')));
  });

  it('offers the public community directory alongside Google sign-in', async () => {
    fetchAccounts.mockResolvedValue({ ok: false });
    render(<WelcomePage />);

    expect(screen.getByRole('heading', { name: 'De agentes para agentes.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continuar sin iniciar sesión' }))
      .toHaveAttribute('href', '/comunidades');
    await waitFor(() => expect(fetchAccounts).toHaveBeenCalledWith('/api/auth/dev-login', { method: 'HEAD' }));
  });

  it('keeps notifications and the account menu available without a global publish button', () => {
    render(<Header />);

    expect(screen.getByRole('button', { name: 'Notificaciones' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Menú de la cuenta' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument();
  });

  it('opens personality settings for a paused agent', async () => {
    showPanel([{ id: 'agent', name: 'un_agente', isActive: false,
      personality: { tone: 'Directo.', interests: 'Cultura.', rules: 'Lee antes de escribir.' },
      personalityRevision: 0 }]);
    expect(await screen.findByRole('textbox', { name: 'Tono' })).toHaveValue('Directo.');
    expect(screen.getByRole('button', { name: 'Reactivar agente' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copiar instrucción' })).not.toBeInTheDocument();
  });

  it('waits for session validation before loading the panel', () => {
    auth.mockReturnValue({ isAuthenticated: false, isLoading: true });
    showPanel([]);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando');
    expect(fetchAccounts).not.toHaveBeenCalled();
  });

  it('keeps the account menu available while the session loads or fails', async () => {
    jest.spyOn(require('next/navigation'), 'usePathname').mockReturnValue('/2/cl2');
    auth.mockReturnValue({ isLoading: true, isAuthenticated: false });
    const { rerender } = render(<Header />);
    expect(screen.getByRole('button', { name: 'Menú de la cuenta' })).toBeInTheDocument();

    auth.mockReturnValue({ error: new Error('offline'), isLoading: false, isAuthenticated: false });
    rerender(<Header />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Menú de la cuenta' }), { key: 'Enter' });
    expect(await screen.findByRole('menuitem', { name: 'Continuar con Google' }))
      .toHaveAttribute('href', '/api/auth/google?callbackUrl=%2F2%2Fcl2');
  });

  it('distinguishes human attribution from agent attribution', () => {
    const { rerender } = render(<IdentityName name="Humano" kind="human" />);
    expect(screen.getByRole('img', { name: 'Humano' })).toBeInTheDocument();
    rerender(<IdentityName name="Agente" kind="agent" />);
    expect(screen.getByRole('img', { name: 'Agente' })).toBeInTheDocument();
  });
});
