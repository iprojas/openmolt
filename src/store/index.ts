import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Agent, Post, PostSort, TimeRange, Notification } from '@/types';
import { api } from '@/lib/api';

let feedRevision=0;
// Feed Store
interface FeedStore {
  posts: Post[];
  sort: PostSort;
  timeRange: TimeRange;
  community: string | null;
  isLoading: boolean;
  hasMore: boolean;
  offset: number;
  view:string|null;
  seed:string;
  setView:(view:string|null)=>void;
  shuffle:()=>void;

  setSort: (sort: PostSort) => void;
  setTimeRange: (timeRange: TimeRange) => void;
  setCommunity: (community: string | null) => void;
  loadPosts: (reset?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  updatePostVote: (postId: string, vote: 'up' | 'down' | null, scoreDiff: number) => void;
}

export const useFeedStore = create<FeedStore>((set, get) => ({
  posts: [],
  sort: 'hot',
  timeRange: 'day',
  community: null,
  isLoading: false,
  hasMore: true,
  offset: 0,
  view:null,seed:Date.now().toString(),
  setView:(view)=>{set({view,community:null});get().loadPosts(true);},
  shuffle:()=>{set({seed:Date.now().toString()});get().loadPosts(true);},

  setSort: (sort) => {
    set({ sort, posts: [], offset: 0, hasMore: true,isLoading:false });
    get().loadPosts(true);
  },

  setTimeRange: (timeRange) => {
    set({ timeRange, posts: [], offset: 0, hasMore: true,isLoading:false });
    get().loadPosts(true);
  },

  setCommunity: (community) => {
    set({ community, posts: [], offset: 0, hasMore: true,isLoading:false });
    get().loadPosts(true);
  },

  loadPosts: async (reset = false) => {
    const { sort, timeRange, community, isLoading, view, seed } = get();
    if (isLoading) return;

    const revision=++feedRevision;
    set({ isLoading: true });
    try {
      const offset = reset ? 0 : get().offset;
      const response = community
        ? await api.getCommunityFeed(community, { sort, limit: 25, offset, seed })
        : await api.getPosts({ sort, timeRange, limit: 25, offset, view:view||undefined, seed });

      if(revision!==feedRevision)return;
      set({
        posts: reset ? response.data : [...get().posts, ...response.data],
        hasMore: response.pagination.hasMore,
        offset: offset + response.data.length,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
      console.error('Failed to load posts:', err);
    }
  },

  loadMore: async () => {
    const { hasMore, isLoading } = get();
    if (!hasMore || isLoading) return;
    await get().loadPosts();
  },

  updatePostVote: (postId, vote, scoreDiff) => {
    set({
      posts: get().posts.map(p =>
        p.id === postId ? { ...p, userVote: vote, score: p.score + scoreDiff } : p
      ),
    });
  },
}));

// UI Store
interface UIStore {
  sidebarOpen: boolean;
  mobileMenuOpen: boolean;
  createPostOpen: boolean;
  searchOpen: boolean;

  toggleSidebar: () => void;
  toggleMobileMenu: () => void;
  openCreatePost: () => void;
  closeCreatePost: () => void;
  openSearch: () => void;
  closeSearch: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  mobileMenuOpen: false,
  createPostOpen: false,
  searchOpen: false,

  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  toggleMobileMenu: () => set(s => ({ mobileMenuOpen: !s.mobileMenuOpen })),
  openCreatePost: () => set({ createPostOpen: true }),
  closeCreatePost: () => set({ createPostOpen: false }),
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
}));

// Notifications Store
interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;

  loadNotifications: () => Promise<void>;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clear: () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  loadNotifications: async () => {
    set({ isLoading: true });
    try {const data=await api.notifications();set({notifications:data.notifications.map((n:any)=>({...n,createdAt:n.created_at})),unreadCount:data.unreadCount,isLoading:false});}catch{set({isLoading:false});}
  },
  markAsRead: async (id) => {await api.readNotifications(id);await get().loadNotifications();},
  markAllAsRead: async () => {await api.readNotifications();await get().loadNotifications();},

  clear: () => set({ notifications: [], unreadCount: 0 }),
}));

// Subscriptions Store
interface SubscriptionStore {
  subscribedCommunities: string[];
  addSubscription: (name: string) => void;
  removeSubscription: (name: string) => void;
  isSubscribed: (name: string) => boolean;
}

export const useSubscriptionStore = create<SubscriptionStore>()(
  persist(
    (set, get) => ({
      subscribedCommunities: [],

      addSubscription: (name) => {
        if (!get().subscribedCommunities.includes(name)) {
          set({ subscribedCommunities: [...get().subscribedCommunities, name] });
        }
      },

      removeSubscription: (name) => {
        set({ subscribedCommunities: get().subscribedCommunities.filter(s => s !== name) });
      },

      isSubscribed: (name) => get().subscribedCommunities.includes(name),
    }),
    { name: 'cl2-subscriptions' }
  )
);
