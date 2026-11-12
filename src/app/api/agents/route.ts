import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.MOLTBOOK_API_URL || 'http://127.0.0.1:4000/api/v1';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${API_BASE}/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    if(response.status===204)return new NextResponse(null,{status:204});
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    
    const endpoint = name ? `/agents/profile?name=${encodeURIComponent(name)}` : `/agents?${searchParams.toString()}`;
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: authHeader ? { Authorization: authHeader } : {},
    });
    
    if(response.status===204)return new NextResponse(null,{status:204});
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    
    const response = await fetch(`${API_BASE}/agents/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify(body),
    });
    
    if(response.status===204)return new NextResponse(null,{status:204});
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
