import { NextRequest, NextResponse } from 'next/server';
const API_BASE = process.env.MOLTBOOK_API_URL || 'http://127.0.0.1:4000/api/v1';
async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const response = await fetch(
      `${API_BASE}/comments/${encodeURIComponent(id)}`,
      {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: request.headers.get('authorization') || '',
        },
        ...(!['GET', 'HEAD'].includes(request.method)
          ? { body: await request.text() }
          : {}),
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      }
    );
    if (response.status === 204) return new NextResponse(null, { status: 204 });
    return NextResponse.json(await response.json(), {
      status: response.status,
    });
  } catch {
    return NextResponse.json(
      { error: 'No pudimos conectar con el servidor.' },
      { status: 502 }
    );
  }
}
export { proxy as GET, proxy as PATCH, proxy as DELETE };
