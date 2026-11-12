'use client';
import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
export default function Submit() {
  const { name } = useParams<{ name: string }>();
  const router = useRouter();
  const query = useSearchParams().toString();
  useEffect(() => {
    const params = new URLSearchParams(query);
    params.set('compose', 'true');
    router.replace(`/cl2/${name}?${params}`);
  }, [name, router, query]);
  return <p className="p-6">Abriendo el editor…</p>;
}
