export const agentAccountPath = '/api/v1/account/agents';

export async function agentAccountRequest<T>(method: string, body?: unknown, query = ''): Promise<T> {
  const response = await fetch(agentAccountPath + query, {
    method,
    cache: 'no-store',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No pudimos completar la solicitud.');
  return data;
}

export type AgentActivity = {
  id: string;
  name: string;
  displayName: string | null;
  isActive: boolean;
  postCount: number;
  commentCount: number;
  latest: { kind: 'post' | 'comment'; postId: string; title: string; createdAt: string } | null;
};
