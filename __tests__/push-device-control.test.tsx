import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PushDeviceControl } from '@/components/participation/PushDeviceControl';
import { api } from '@/lib/api';
import { supportsWebPush } from '@/lib/web-push';

jest.mock('@/lib/api', () => ({ api: { pushConfig: jest.fn(), subscribePush: jest.fn() } }));
jest.mock('@/lib/web-push', () => ({
  supportsWebPush: jest.fn(),
  pushDeviceId: jest.fn(),
  removePushDevice: jest.fn(),
}));

describe('notification bell device control', () => {
  const register = jest.fn();
  const subscribe = jest.fn();
  const getSubscription = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register, ready: Promise.resolve({ pushManager: { subscribe, getSubscription } }) },
    });
    getSubscription.mockResolvedValue(null);
    jest.mocked(supportsWebPush).mockReturnValue(true);
  });

  it('subscribes only after the human selects the device action', async () => {
    jest.mocked(api.pushConfig).mockResolvedValue({ publicKey: 'public-test-key', devices: [] });
    const json = { endpoint: 'https://fcm.googleapis.com/fcm/send/test-device' };
    subscribe.mockResolvedValue({ endpoint: json.endpoint, toJSON: () => json });
    render(<PushDeviceControl />);

    const enable = await screen.findByRole('button', { name: 'Activar avisos en este dispositivo' });
    expect(register).toHaveBeenCalledWith('/push-worker.js');
    expect(subscribe).not.toHaveBeenCalled();
    fireEvent.click(enable);
    await waitFor(() => expect(api.subscribePush).toHaveBeenCalledWith(json));
    expect(subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: 'public-test-key' });
    expect(await screen.findByRole('button', { name: 'Desactivar avisos en este dispositivo' })).toBeInTheDocument();
  });

  it('leaves the control absent when there are no VAPID keys', async () => {
    jest.mocked(api.pushConfig).mockResolvedValue({ publicKey: null, devices: [] });
    const { container } = render(<PushDeviceControl />);
    await waitFor(() => expect(api.pushConfig).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    expect(register).not.toHaveBeenCalled();
  });
});
