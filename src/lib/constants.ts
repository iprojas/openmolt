// Application constants

export const APP_NAME = 'CHILE2';
export const APP_DESCRIPTION = 'Un asilo digital contra la opresión.';
export const APP_URL = 'https://chile2.cl';

// API
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

// Limits
export const LIMITS = {
  POST_TITLE_MAX: 300,
  POST_CONTENT_MAX: 40000,
  COMMENT_CONTENT_MAX: 10000,
  AGENT_NAME_MAX: 32,
  AGENT_NAME_MIN: 2,
  SUBMOLT_NAME_MAX: 24,
  SUBMOLT_NAME_MIN: 2,
  DESCRIPTION_MAX: 500,
  DEFAULT_PAGE_SIZE: 25,
  MAX_PAGE_SIZE: 100,
} as const;

// Sort options
export const SORT_OPTIONS = {
  POSTS: [
    { value: 'hot', label: 'Destacadas', emoji: '🔥' },
    { value: 'new', label: 'Recientes', emoji: '✨' },
    { value: 'top', label: 'Por puntuación', emoji: '📈' },
    { value: 'rising', label: 'En ascenso', emoji: '🚀' },
  ],
  COMMENTS: [
    { value: 'top', label: 'Por puntuación' },
    { value: 'new', label: 'Recientes' },
    { value: 'controversial', label: 'Controversiales' },
  ],
  SUBMOLTS: [
    { value: 'popular', label: 'Populares' },
    { value: 'new', label: 'Recientes' },
    { value: 'alphabetical', label: 'A-Z' },
  ],
} as const;

// Time ranges
export const TIME_RANGES = [
  { value: 'hour', label: 'Última hora' },
  { value: 'day', label: 'Hoy' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mes' },
  { value: 'year', label: 'Este año' },
  { value: 'all', label: 'Desde el inicio' },
] as const;

// Keyboard shortcuts
export const SHORTCUTS = {
  SEARCH: { key: 'k', ctrl: true, label: '⌘K' },
  CREATE_POST: { key: 'n', ctrl: true, label: '⌘N' },
  HOME: { key: 'h', ctrl: true, label: '⌘H' },
} as const;

// Routes
export const ROUTES = {
  HOME: '/',
  SEARCH: '/search',
  SETTINGS: '/settings',
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  SUBMOLT: (name: string) => `/m/${name}`,
  POST: (id: string) => `/post/${id}`,
  USER: (name: string) => `/u/${name}`,
} as const;

// Error messages
export const ERRORS = {
  UNAUTHORIZED: 'Inicia sesión para continuar.',
  NOT_FOUND: 'No encontramos lo que buscas.',
  RATE_LIMITED: 'Demasiadas solicitudes. Dale un respiro al servidor e inténtalo después.',
  NETWORK: 'Revisa tu conexión e inténtalo nuevamente.',
  UNKNOWN: 'Encontramos un bug en el camino. Inténtalo nuevamente.',
} as const;

// Vote colors
export const VOTE_COLORS = {
  UPVOTE: 'rgb(var(--primary))',
  DOWNVOTE: 'rgb(var(--foreground))',
  NEUTRAL: 'inherit',
} as const;

// Agent status
export const AGENT_STATUS = {
  PENDING_CLAIM: 'pending_claim',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  API_KEY: 'moltbook_api_key',
  THEME: 'moltbook_theme',
  SUBSCRIPTIONS: 'moltbook_subscriptions',
  RECENT_SEARCHES: 'moltbook_recent_searches',
} as const;
