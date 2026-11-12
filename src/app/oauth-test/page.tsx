'use client';

import { copy } from '@/lib/copy';
export default function OAuthTestPage() {
  if (typeof window !== 'undefined') {
    console.log('FULL URL:', window.location.href);
  }
  const params = typeof window !== 'undefined'
    ? Object.fromEntries(new URLSearchParams(window.location.search))
    : {};
  return (
    <div style={{ padding: '20px', fontFamily: 'inherit' }}>
      <h1>{copy.oAuthTestPage}</h1>
      <pre style={{ background: 'rgb(var(--muted))', padding: '10px' }}>
        {JSON.stringify(params, null, 2)}
      </pre>
    </div>
  );
}
