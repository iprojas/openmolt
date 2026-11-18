import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import useSWR, { SWRConfiguration, useSWRConfig } from 'swr';
import { useInView } from 'react-intersection-observer';
import { api, ApiError } from '@/lib/api';
import { useFeedStore, useUIStore, useSubscriptionStore } from '@/store';
import type { Post, Comment, Agent, Community, PostSort, CommentSort } from '@/types';
import { debounce } from '@/lib/utils';

// Re-export store hooks
export { useSubscriptionStore };

// SWR fetcher
const fetcher = <T>(fn: () => Promise<T>) => fn();

// Auth hooks
export function useAuth() {
  const { data, error, isLoading, mutate } = useSWR('human-session', async () => {
    const response = await fetch('/api/auth/session', { cache: 'no-store' });
    if (response.status === 401) return null;
    if (!response.ok) throw new Error('No pudimos cargar tu cuenta.');
    return response.json();
  });
  const agent: Agent | null = data?.participant || null;
  const logout = async () => {
    const response = await fetch('/api/auth/session', { method: 'DELETE' });
    if (!response.ok) throw new Error('No pudimos cerrar la sesión.');
    await mutate(null, { revalidate: false });
    window.location.assign('/welcome');
  };
  // agent is the shared participant shape consumed by existing forum components.
  return { user: data?.user, accounts: data?.accounts || [], agent, agentName: agent?.name,
    participantId: agent?.id, isLoading, error, isAuthenticated: !!data?.user,
    logout, refresh: mutate };
}

// Post hooks
export function usePost(postId: string, config?: SWRConfiguration) {
  const {participantId}=useAuth();
  return useSWR<Post>(postId ? ['post', postId, participantId] : null, () => api.getPost(postId), config);
}

export function usePosts(options: { sort?: PostSort; community?: string } = {}, config?: SWRConfiguration) {
  const key = useMemo(() => ['posts', options.sort || 'hot', options.community || 'all'], [options.sort, options.community]);
  return useSWR(key, () => api.getPosts({ sort: options.sort, community: options.community }), config);
}

export function usePostVote(postId: string) {
  const [isVoting, setIsVoting] = useState(false);
  const {mutate}=useSWRConfig();
  const updatePostVote = useFeedStore(s => s.updatePostVote);

  const vote = useCallback(async (direction: 'up' | 'down') => {
    if (isVoting) return;
    setIsVoting(true);
    try {
      const result = direction === 'up' ? await api.upvotePost(postId) : await api.downvotePost(postId);
      updatePostVote(postId,result.user_vote,result.scoreDelta);
      await mutate(key=>Array.isArray(key)&&['post','agent'].includes(key[0]));
    } catch (err) {
      console.error('Vote failed:', err);
    } finally {
      setIsVoting(false);
    }
  }, [postId, isVoting, updatePostVote, mutate]);

  return { vote, isVoting };
}

// Comment hooks
export function useComments(postId: string, options: { sort?: CommentSort } = {}, config?: SWRConfiguration) {
  const {participantId}=useAuth();
  return useSWR<Comment[]>(postId ? ['comments', postId, options.sort || 'top',participantId] : null, () => api.getComments(postId, options), config);
}

export function useCommentVote(commentId: string) {
  const {mutate}=useSWRConfig();
  const [isVoting, setIsVoting] = useState(false);

  const vote = useCallback(async (direction: 'up' | 'down') => {
    if (isVoting) return;
    setIsVoting(true);
    try {
      direction === 'up' ? await api.upvoteComment(commentId) : await api.downvoteComment(commentId);
      await mutate(key=>Array.isArray(key)&&key[0]==='comments');
    } catch (err) {
      console.error('Vote failed:', err);
    } finally {
      setIsVoting(false);
    }
  }, [commentId, isVoting, mutate]);

  return { vote, isVoting };
}

// Agent hooks
export function useAgent(name: string, config?: SWRConfiguration) {
  const {participantId}=useAuth();
  return useSWR<{ agent: Agent; isFollowing: boolean; recentPosts: Post[] }>(
    name ? ['agent', name,participantId] : null, () => api.getAgent(name), config
  );
}

export function useCurrentAgent() {
  const { agent, refresh, isLoading, error } = useAuth();
  return { data: agent || undefined, mutate: refresh, isLoading, error };
}

// Community hooks
export function useCommunity(name: string, config?: SWRConfiguration) {
  const {participantId}=useAuth();
  return useSWR<Community>(name ? ['community', name,participantId] : null, () => api.getCommunity(name), config);
}

export function useCommunities(config?: SWRConfiguration) {
  const {participantId}=useAuth();
  return useSWR<{ data: Community[] }>(['communities',participantId], () => api.getCommunities(), config);
}

// Search hook
export function useSearch(query: string, config?: SWRConfiguration) {
  const {participantId}=useAuth();
  const debouncedQuery = useDebounce(query, 300);
  return useSWR(
    debouncedQuery.length >= 2 ? ['search', debouncedQuery,participantId] : null,
    () => api.search(debouncedQuery), config
  );
}

// Infinite scroll hook
export function useInfiniteScroll(onLoadMore: () => void, hasMore: boolean) {
  const { ref, inView } = useInView({ threshold: 0, rootMargin: '100px' });

  useEffect(() => {
    if (inView && hasMore) onLoadMore();
  }, [inView, hasMore, onLoadMore]);

  return { ref, inView };
}

// Debounce hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Local storage hook
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch { return initialValue; }
  });

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue(prev => {
      const newValue = value instanceof Function ? value(prev) : value;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(newValue));
      }
      return newValue;
    });
  }, [key]);

  return [storedValue, setValue];
}

// Media query hook
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

// Breakpoint hooks
export function useIsMobile() {
  return useMediaQuery('(max-width: 639px)');
}

export function useIsTablet() {
  return useMediaQuery('(min-width: 640px) and (max-width: 1023px)');
}

export function useIsDesktop() {
  return useMediaQuery('(min-width: 1024px)');
}

// Click outside hook
export function useClickOutside<T extends HTMLElement>(callback: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [callback]);

  return ref;
}

// Keyboard shortcut hook
export function useKeyboardShortcut(key: string, callback: () => void, options: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === key.toLowerCase() &&
        (!options.ctrl || event.ctrlKey || event.metaKey) &&
        (!options.shift || event.shiftKey) &&
        (!options.alt || event.altKey)
      ) {
        event.preventDefault();
        callback();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [key, callback, options]);
}

// Copy to clipboard hook
export function useCopyToClipboard(): [boolean, (text: string) => Promise<void>] {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { setCopied(false); }
  }, []);

  return [copied, copy];
}

// Toggle hook
export function useToggle(initialValue = false): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = useState(initialValue);
  const toggle = useCallback(() => setValue(v => !v), []);
  return [value, toggle, setValue];
}

// Previous value hook
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => { ref.current = value; });
  return ref.current;
}
