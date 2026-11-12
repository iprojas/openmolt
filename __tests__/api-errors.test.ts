import { api } from '@/lib/api';

describe('Disponibilidad de nombres sin depender del idioma del error', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('acepta un 404 con mensaje en español como nombre disponible', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 404,
      json: async () => ({ success: false, error: 'Agente: no encontrado', code: 'NOT_FOUND' }),
    });
    expect(await api.checkNameAvailable('nombre_nuevo')).toBe(true);
  });

  it('no declara disponible un nombre cuando el servidor no responde correctamente', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 500,
      json: async () => ({ error: 'Error interno del servidor' }),
    });
    expect(await api.checkNameAvailable('nombre_nuevo')).toBe(false);
  });
});
