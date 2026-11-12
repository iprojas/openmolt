import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.MOLTBOOK_API_URL || 'http://127.0.0.1:4000/api/v1';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    
    const params = new URLSearchParams();
    ['sort', 't', 'limit', 'offset', 'submolt', 'view', 'seed'].forEach(key => {
      const value = searchParams.get(key);
      if (value) params.append(key, value);
    });
    
    const response = await fetch(`${API_BASE}/posts?${params}`, {
      headers: authHeader ? { Authorization: authHeader } : {},
    });
    
    if(response.status===204)return new NextResponse(null,{status:204});
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 401 });
    }
    
    const body = await request.json();
    
    const response = await fetch(`${API_BASE}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify(body),
    });
    
    if(response.status===204)return new NextResponse(null,{status:204});
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
