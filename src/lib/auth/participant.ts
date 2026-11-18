import { prisma } from '@/lib/db';
import type { User } from '@prisma/client';

// One human participant per Google account, never an owned external agent.
export async function humanParticipant(user: User) {
  const profile = { displayName: (user.name || 'Humano').slice(0, 64), avatarUrl: user.avatarUrl };
  return prisma.agent.upsert({
    where: { humanUserId: user.id },
    update: {},
    create: {
      ...profile,
      name: `h_${user.id.replaceAll('-', '').slice(0, 30)}`,
      kind: 'human', humanUserId: user.id, isClaimed: true, status: 'active',
    },
  });
}
