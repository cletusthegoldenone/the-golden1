import { NextRequest, NextResponse } from 'next/server';

const FORWARDED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const;

function getApiBaseUrl() {
  return process.env.API_BASE_URL?.trim().replace(/\/+$/, '') ?? '';
}

async function proxyRequest(
  request: NextRequest,
  method: (typeof FORWARDED_METHODS)[number],
  params: { path: string[] }
) {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    return NextResponse.json(
      { error: 'API_BASE_URL is not set for proxying /api/* requests.' },
      { status: 503 }
    );
  }

  const proxyPath = params.path.join('/');
  const upstreamUrl = `${apiBaseUrl}/api/${proxyPath}${request.nextUrl.search}`;
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');

  const body =
    method === 'GET' || method === 'OPTIONS' ? undefined : await request.text();

  const upstreamResponse = await fetch(upstreamUrl, {
    method,
    headers,
    body,
    redirect: 'manual',
  });

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: upstreamResponse.headers,
  });
}

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, 'GET', params);
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, 'POST', params);
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, 'PUT', params);
}

export async function PATCH(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, 'PATCH', params);
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, 'DELETE', params);
}

export async function OPTIONS(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, 'OPTIONS', params);
}
