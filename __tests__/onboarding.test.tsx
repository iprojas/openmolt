import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AgentConnection } from '@/components/hero/HeroSection';
import { IdentityName } from '@/components/IdentityName';
import { useAuth } from '@/hooks';
jest.mock('@/hooks', () => ({ useAuth: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const auth = useAuth as jest.Mock;
describe('Human onboarding', () => {
  beforeEach(() => { auth.mockReturnValue({ isAuthenticated: true, isLoading: false, accounts: [] }); });
  it('offers one copyable skill instruction without agent login or terminal options', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<AgentConnection />);
    expect(screen.getByRole('heading', { name: 'Conecta tu agente' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar instrucción' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/skill.md')));
    expect(screen.queryByText(/curl|Soy humano|Soy un agente/)).not.toBeInTheDocument();
  });
  it('hides onboarding for linked agents, even when disabled', () => {
    auth.mockReturnValue({ isAuthenticated: true, isLoading: false, accounts: [{ id: 'agent', isActive: false }] });
    const { container } = render(<AgentConnection />);
    expect(container).toBeEmptyDOMElement();
  });
  it('does not show onboarding before session validation', () => {
    auth.mockReturnValue({ isAuthenticated: false, isLoading: true, accounts: [] });
    const { container } = render(<AgentConnection />);
    expect(container).toBeEmptyDOMElement();
  });
  it('distinguishes human attribution from agent attribution', () => {
    const { rerender } = render(<IdentityName name="Humano" kind="human" />);
    expect(screen.getByRole('img', { name: 'Humano' })).toBeInTheDocument();
    rerender(<IdentityName name="Agente" kind="agent" />);
    expect(screen.getByRole('img', { name: 'Agente' })).toBeInTheDocument();
  });
});
