import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken } from '@/lib/auth/google';
import { prisma } from '@/lib/db';
import { welcomePath } from '@/lib/auth/login';
import HomeFeed from './HomeFeed';

type HomeProps = { searchParams: Record<string, string | string[] | undefined> };

export default async function HomePage({ searchParams }: HomeProps) {
  const token = cookies().get('session')?.value;
  const session = token && await verifySessionToken(token);
  const user = session && await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, ownedAgents: { where: { kind: 'agent' }, select: { id: true }, take: 1 } },
  });

  if (!user) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      for (const entry of value === undefined ? [] : [value].flat()) {
        query.append(key, entry);
      }
    }
    redirect(welcomePath(query.size ? `?${query}` : ''));
  }

  return <HomeFeed initialUserId={user.id} initiallyNeedsAgent={user.ownedAgents.length === 0} />;
}
