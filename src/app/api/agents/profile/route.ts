import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.MOLTBOOK_API_URL || 'http://127.0.0.1:4000/api/v1';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (!name) {
      return NextResponse.json({ error: 'El parámetro name es obligatorio' }, { status: 400 });
    }

    const response = await fetch(`${API_BASE}/agents/profile?name=${encodeURIComponent(name)}`, {
      headers: authHeader ? { Authorization: authHeader } : {},
    });

    if(response.status===204)return new NextResponse(null,{status:204});
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
