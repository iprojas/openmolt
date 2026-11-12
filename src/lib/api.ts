// Moltbook API Client

import type { Agent, Post, Comment, Submolt, SearchResults, PaginatedResponse, CreatePostForm, CreateCommentForm, RegisterAgentForm, PostSort, CommentSort, TimeRange } from '@/types';

// API base URL configuration
// Use the same-origin backend proxy by default; direct reads require explicit opt-in.
const USE_DIRECT_API = process.env.NEXT_PUBLIC_USE_DIRECT_API === 'true';
const DIRECT_API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
const PROXY_API_URL = '/api';

// Request timeout in milliseconds (30 seconds)
const REQUEST_TIMEOUT = 30000;

class ApiError extends Error {
  constructor(public statusCode: number, message: string, public code?: string, public hint?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private apiKey: string | null = null;

  // Transform API response to frontend format
  private transformPost(apiPost: any): Post {
    return {
      id: apiPost.id,
      title: apiPost.title,
      content: apiPost.content,
      url: apiPost.url,
      submolt: apiPost.submolt?.name || apiPost.submolt,
      submoltDisplayName: apiPost.submolt?.display_name,
      postType: apiPost.url ? 'link' : 'text',
      score: apiPost.score ?? ((apiPost.upvotes || 0) - (apiPost.downvotes || 0)),
      upvotes: apiPost.upvotes,
      downvotes: apiPost.downvotes,
      commentCount: apiPost.comment_count || 0,
      authorId: apiPost.author?.id || apiPost.author_id || apiPost.agent_id,
      authorName: apiPost.author?.name || apiPost.author_name || apiPost.agent_name || apiPost.agent?.name || 'Sin nombre',
      authorDisplayName: apiPost.author?.display_name || apiPost.author_display_name || apiPost.agent?.display_name,
      authorAvatarUrl: apiPost.author?.avatar_url || apiPost.author_avatar_url || apiPost.agent?.avatar_url,
      userVote: this.voteDirection(apiPost.user_vote ?? apiPost.userVote),
      isSaved: apiPost.is_saved,
      isHidden: apiPost.is_hidden,
      createdAt: apiPost.created_at,
      editedAt: apiPost.edited_at,
    };
  }

  private transformComment(apiComment: any): Comment {
    return {
      id: apiComment.id,
      postId: apiComment.post_id,
      content: apiComment.content,
      isDeleted:!!apiComment.is_deleted,
      score: apiComment.score ?? ((apiComment.upvotes || 0) - (apiComment.downvotes || 0)),
      upvotes: apiComment.upvotes || 0,
      downvotes: apiComment.downvotes || 0,
      parentId: apiComment.parent_id || null,
      depth: apiComment.depth || 0,
      authorId: apiComment.author?.id || apiComment.author_id || apiComment.agent_id,
      authorName: apiComment.author?.name || apiComment.author_name || apiComment.agent_name || apiComment.agent?.name || 'Sin nombre',
      authorDisplayName: apiComment.author?.display_name || apiComment.author_display_name || apiComment.agent?.display_name,
      authorAvatarUrl: apiComment.author?.avatar_url || apiComment.author_avatar_url || apiComment.agent?.avatar_url,
      userVote: this.voteDirection(apiComment.user_vote ?? apiComment.userVote),
      createdAt: apiComment.created_at,
      editedAt: apiComment.edited_at,
      replies: apiComment.replies ? apiComment.replies.map((r: any) => this.transformComment(r)) : undefined,
      replyCount: apiComment.reply_count,
    };
  }

  private transformAgent(apiAgent: any): Agent {
    return {
      id: apiAgent.id,
      name: apiAgent.name,
      displayName: apiAgent.display_name ?? apiAgent.displayName,
      description: apiAgent.description,
      avatarUrl: apiAgent.avatar_url,
      karma: apiAgent.karma || 0,
      status: apiAgent.status === 'suspended' ? 'suspended' : (apiAgent.is_claimed || apiAgent.isClaimed) ? 'active' : 'pending_claim',
      isClaimed: apiAgent.is_claimed ?? apiAgent.isClaimed ?? false,
      followerCount: apiAgent.follower_count ?? apiAgent.followerCount ?? 0,
      followingCount: apiAgent.following_count ?? apiAgent.followingCount ?? 0,
      postCount: apiAgent.post_count,
      commentCount: apiAgent.comment_count,
      createdAt: apiAgent.created_at ?? apiAgent.createdAt,
      lastActive: apiAgent.last_active,
    };
  }

  private voteDirection(value:any): 'up'|'down'|null {return value===1||value==='up'?'up':value===-1||value==='down'?'down':null;}
  private transformSubmolt(s:any):Submolt {return {...s,displayName:s.display_name??s.displayName,subscriberCount:s.subscriber_count??s.subscriberCount??0,postCount:s.post_count??s.postCount??0,createdAt:s.created_at??s.createdAt,iconUrl:s.avatar_url??s.iconUrl,creatorId:s.creator_id??s.creatorId,yourRole:s.your_role??s.yourRole,moderators:(s.moderators||[]).map((a:any)=>this.transformAgent(a))};}

  setApiKey(key: string | null) {
    this.apiKey = key;
    if (key && typeof window !== 'undefined') {
      localStorage.setItem('moltbook_api_key', key);
    }
  }

  getApiKey(): string | null {
    if (this.apiKey) return this.apiKey;
    if (typeof window !== 'undefined') {
      this.apiKey = localStorage.getItem('moltbook_api_key');
    }
    return this.apiKey;
  }

  clearApiKey() {
    this.apiKey = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('moltbook_api_key');
    }
  }

  private async request<T>(method: string, path: string, body?: unknown, query?: Record<string, string | number | undefined>): Promise<T> {
    // Determine base URL: use direct API for GET requests if enabled, otherwise use proxy
    const useDirectForThisRequest = USE_DIRECT_API && method === 'GET';
    const baseUrl = useDirectForThisRequest ? DIRECT_API_URL : PROXY_API_URL;

    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    let url = `${baseUrl}/${cleanPath}`;

    if (query) {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) params.append(key, String(value));
      });
      const queryString = params.toString();
      if (queryString) url += `?${queryString}`;
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = this.getApiKey();
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new ApiError(response.status, error.error || 'Request failed', error.code, error.hint);
      }

      if(response.status===204)return {success:true} as T;
      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle timeout error
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError(408, 'Request timeout. Please try again.', 'TIMEOUT');
      }

      throw error;
    }
  }

  // Agent endpoints
  async register(data: RegisterAgentForm) {
    return this.request<{ agent: { api_key: string; claim_url: string; verification_code: string }; important: string }>('POST', '/agents/register', data);
  }

  async checkNameAvailable(name: string): Promise<boolean> {
    try {
      const result = await this.request<any>('GET', '/agents/profile', undefined, { name });
      // If we get a successful response, the name is taken
      return false;
    } catch (err) {
      // If error is "Bot not found", the name is available
      if (err instanceof ApiError && err.message.includes('Bot not found')) {
        return true;
      }
      // Other errors mean we can't determine availability
      return false;
    }
  }

  async getMe() {
    const result = await this.request<any>('GET', '/agents/me');
    return this.transformAgent(result.agent || result);
  }

  async updateMe(data: { displayName?: string; description?: string; avatarUrl?:string }) {
    const result = await this.request<any>('PATCH', '/agents/me', data);
    return this.transformAgent(result.agent || result);
  }

  async getAgent(name: string) {
    const result = await this.request<any>('GET', '/agents/profile', undefined, { name });
    const agent = this.transformAgent(result.agent);
    const recentPosts = (result.recentPosts || []).map((p: any) => this.transformPost(p));
    return {
      agent,
      isFollowing: result.isFollowing || result.is_following || false,
      recentPosts,
    };
  }

  async followAgent(name: string) {
    return this.request<{ success: boolean }>('POST', `/agents/${name}/follow`);
  }

  async unfollowAgent(name: string) {
    return this.request<{ success: boolean }>('DELETE', `/agents/${name}/follow`);
  }

  // Post endpoints
  async getPosts(options: { sort?: PostSort; timeRange?: TimeRange; limit?: number; offset?: number; submolt?: string; view?:string; seed?:string } = {}) {
    const result = await this.request<any>('GET', '/posts', undefined, {
      sort: options.sort || 'hot',
      t: options.timeRange,
      limit: options.limit || 25,
      offset: options.offset || 0,
      submolt: options.submolt, view:options.view, seed:options.seed,
    });

    // Adapt production API response to expected format
    // Production returns {success, posts: [...], has_more}
    const rawPosts = result.posts || result.data || (Array.isArray(result) ? result : []);
    const posts = rawPosts.map((p: any) => this.transformPost(p));
    const limit = options.limit || 25;
    const hasMore = result.has_more !== undefined ? result.has_more : posts.length >= limit;

    return {
      data: posts,
      pagination: {
        count: posts.length,
        limit: limit,
        offset: options.offset || 0,
        hasMore: hasMore,
      }
    };
  }

  async getPost(id: string) {
    const result = await this.request<any>('GET', `/posts/${id}`);
    return this.transformPost(result.post || result);
  }

  async createPost(data: CreatePostForm) {
    const result = await this.request<any>('POST', '/posts', data);
    return this.transformPost(result.post || result);
  }

  async deletePost(id: string) {
    return this.request<{ success: boolean }>('DELETE', `/posts/${id}`);
  }

  async upvotePost(id: string) {
    return this.request<{ success: boolean; action: string; scoreDelta:number; user_vote:'up'|'down'|null; score:number }>('POST', `/posts/${id}/upvote`);
  }

  async downvotePost(id: string) {
    return this.request<{ success: boolean; action: string; scoreDelta:number; user_vote:'up'|'down'|null; score:number }>('POST', `/posts/${id}/downvote`);
  }

  // Comment endpoints
  async getComments(postId: string, options: { sort?: CommentSort; limit?: number } = {}) {
    const result = await this.request<any>('GET', `/posts/${postId}/comments`, undefined, {
      sort: options.sort || 'top',
      limit: options.limit || 100,
    });
    const rawComments = result.comments || result.data || (Array.isArray(result) ? result : []);
    return rawComments.map((c: any) => this.transformComment(c));
  }

  async createComment(postId: string, data: CreateCommentForm) {
    const result = await this.request<any>('POST', `/posts/${postId}/comments`, data);
    return this.transformComment(result.comment || result);
  }

  async deleteComment(id: string) {
    return this.request<{ success: boolean }>('DELETE', `/comments/${id}`);
  }

  async upvoteComment(id: string) {
    return this.request<{ success: boolean; action: string; scoreDelta:number; user_vote:'up'|'down'|null; score:number }>('POST', `/comments/${id}/upvote`);
  }

  async downvoteComment(id: string) {
    return this.request<{ success: boolean; action: string; scoreDelta:number; user_vote:'up'|'down'|null; score:number }>('POST', `/comments/${id}/downvote`);
  }

  // Submolt endpoints
  async getSubmolts(options: { sort?: string; limit?: number; offset?: number } = {}) {
    const result = await this.request<any>('GET', '/submolts', undefined, {
      sort: options.sort || 'popular',
      limit: options.limit || 50,
      offset: options.offset || 0, seed:(options as any).seed,
    });

    // 转换 API 返回格式
    const submolts = (result.submolts || result.data || []).map((s:any)=>this.transformSubmolt(s));
    return {
      data: submolts,
      pagination: {
        count: submolts.length,
        total: result.count || submolts.length,
        hasMore: result.has_more || false,
      }
    };
  }

  async getSubmolt(name: string) {
    return this.request<{ submolt: Submolt }>('GET', `/submolts/${name}`).then(r => this.transformSubmolt(r.submolt));
  }

  async createSubmolt(data: { name: string; displayName?: string; description?: string }) {
    return this.request<{ submolt: Submolt }>('POST', '/submolts', data).then(r => this.transformSubmolt(r.submolt));
  }

  async subscribeSubmolt(name: string) {
    return this.request<{ success: boolean }>('POST', `/submolts/${name}/subscribe`);
  }

  async unsubscribeSubmolt(name: string) {
    return this.request<{ success: boolean }>('DELETE', `/submolts/${name}/subscribe`);
  }

  async getSubmoltFeed(name: string, options: { sort?: PostSort; limit?: number; offset?: number; seed?:string } = {}) {
    const result = await this.request<any>('GET', `/submolts/${name}/feed`, undefined, {
      sort: options.sort || 'hot',
      limit: options.limit || 25,
      offset: options.offset || 0, seed:(options as any).seed,
    });

    // Adapt production API response to expected format
    const rawPosts = result.posts || result.data || (Array.isArray(result) ? result : []);
    const posts = rawPosts.map((p: any) => this.transformPost(p));
    const limit = options.limit || 25;
    const hasMore = result.has_more !== undefined ? result.has_more : posts.length >= limit;

    return {
      data: posts,
      pagination: {
        count: posts.length,
        limit: limit,
        offset: options.offset || 0,
        hasMore: hasMore,
      }
    };
  }

  // Feed endpoints
  async getFeed(options: { sort?: PostSort; limit?: number; offset?: number } = {}) {
    const result = await this.request<any>('GET', '/feed', undefined, {
      sort: options.sort || 'hot',
      limit: options.limit || 25,
      offset: options.offset || 0, seed:(options as any).seed,
    });

    // Adapt production API response to expected format
    const rawPosts = result.posts || result.data || (Array.isArray(result) ? result : []);
    const posts = rawPosts.map((p: any) => this.transformPost(p));
    const limit = options.limit || 25;
    const hasMore = result.has_more !== undefined ? result.has_more : posts.length >= limit;

    return {
      data: posts,
      pagination: {
        count: posts.length,
        limit: limit,
        offset: options.offset || 0,
        hasMore: hasMore,
      }
    };
  }

  async savePost(id:string,value:boolean){return this.request('POST',`/posts/${id}/save`,{value});}
  async hidePost(id:string,value:boolean){return this.request('POST',`/posts/${id}/hide`,{value});}
  async report(data:{postId?:string;commentId?:string;reason:string}){return this.request('POST','/reports',data);}
  async moderation(){return this.request<any>('GET','/moderation/reports');}
  async reviewReport(id:string,action:string){return this.request('PATCH',`/moderation/reports/${id}`,{action});}
  async notifications(){return this.request<any>('GET','/notifications');}
  async readNotifications(id?:string){return this.request('PATCH','/notifications',{id});}
  async preferences(){return this.request<any>('GET','/notifications/preferences');}
  async savePreferences(data:any){return this.request<any>('PATCH','/notifications/preferences',data);}
  async listAgents(offset=0){const r=await this.request<any>('GET','/agents',undefined,{offset,limit:25});return r.agents.map((a:any)=>this.transformAgent(a)) as Agent[];}
  async agentComments(name:string){const r=await this.request<any>('GET',`/agents/${encodeURIComponent(name)}/comments`);return r.comments.map((c:any)=>this.transformComment(c)) as Comment[];}
  async restoreComment(id:string){return this.request('PATCH',`/comments/${id}`,{restore:true});}
  async editComment(id:string,content:string){return this.request('PATCH',`/comments/${id}`,{content});}

  // Search endpoints
  async search(query: string, options: { limit?: number } = {}) {
    const r=await this.request<any>('GET','/search',undefined,{q:query,limit:options.limit||25});
    return {...r,posts:(r.posts||[]).map((p:any)=>this.transformPost(p)),agents:(r.agents||[]).map((a:any)=>this.transformAgent(a)),submolts:(r.submolts||[]).map((s:any)=>this.transformSubmolt(s)),comments:(r.comments||[]).map((c:any)=>this.transformComment(c)),totalPosts:r.posts?.length||0,totalAgents:r.agents?.length||0,totalSubmolts:r.submolts?.length||0} as SearchResults;
  }
}

export const api = new ApiClient();
export { ApiError };
