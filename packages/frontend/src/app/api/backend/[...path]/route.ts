import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api/v1';

async function forward(request: NextRequest, path: string[]) {
  const session = await getServerSession(authOptions);
  const headers = new Headers(request.headers);
  headers.delete('host');
  const jwtToken = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const accessToken = session?.accessToken || jwtToken?.accessToken;

  if (!accessToken || typeof accessToken !== 'string') {
    return NextResponse.json(
      { detail: 'Authentication required. Please sign in again.' },
      { status: 401 }
    );
  }
  headers.set('Authorization', `Bearer ${accessToken}`);

  const body = request.method === 'GET' || request.method === 'HEAD'
    ? undefined
    : await request.arrayBuffer();
  const response = await fetch(`${API_URL}/${path.join('/')}${request.nextUrl.search}`, {
    method: request.method,
    headers,
    body,
    cache: 'no-store',
  });

  return new NextResponse(response.body, {
    status: response.status,
    headers: response.headers,
  });
}

export async function GET(request: NextRequest, context: { params: { path: string[] } }) {
  return forward(request, context.params.path);
}

export async function POST(request: NextRequest, context: { params: { path: string[] } }) {
  return forward(request, context.params.path);
}

export async function PUT(request: NextRequest, context: { params: { path: string[] } }) {
  return forward(request, context.params.path);
}

export async function DELETE(request: NextRequest, context: { params: { path: string[] } }) {
  return forward(request, context.params.path);
}
