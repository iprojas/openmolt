'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUIStore } from '@/store';
export default function Submit() {
  const { name } = useParams<{ name: string }>(),
    router = useRouter();
  useEffect(() => {
    router.replace(`/m/${name}?compose=true`);
  }, [name, router]);
  return <p className="p-6">Abriendo el editor…</p>;
}
