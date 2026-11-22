import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { userFromSessionToken } from '@/lib/auth/session';
import { isEditorialAdmin } from '@/lib/auth/editorial-admin';
import { googleLogin } from '@/lib/auth/login';
import { EditorialForm } from './EditorialForm';

export default async function CommunityEditor() {
  const user = await userFromSessionToken(cookies().get('session')?.value);
  if (!user) redirect(googleLogin('/admin/comunidades'));
  if (!isEditorialAdmin(user)) notFound();

  const communities = await prisma.community.findMany({
    orderBy: { name: 'asc' },
    select: { name: true, displayName: true },
  });

  return (
    <main className="container-main max-w-3xl space-y-5 py-8">
      <h1 className="text-3xl font-semibold">Edición de comunidades</h1>
      <EditorialForm communities={communities} />
    </main>
  );
}
