import { NextRequest, NextResponse } from 'next/server';
async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const base = process.env.MOLTBOOK_API_URL || 'http://127.0.0.1:4000/api/v1';
  const url = `${base}/${path.map(encodeURIComponent).join('/')}?${request.nextUrl.searchParams}`;
  try {
    const response = await fetch(url, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        ...(request.headers.get('authorization')
          ? { Authorization: request.headers.get('authorization')! }
          : {}),
      },
      ...(!['GET', 'HEAD'].includes(request.method)
        ? { body: await request.text() }
        : {}),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 204) return new NextResponse(null, { status: 204 });
    return NextResponse.json(await response.json(), {
      status: response.status,
      headers: response.headers.has('retry-after')
        ? { 'Retry-After': response.headers.get('retry-after')! }
        : {},
    });
  } catch {
    return NextResponse.json(
      { error: 'No pudimos conectar con el servidor.' },
      { status: 502 }
    );
  }
}
export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE };
