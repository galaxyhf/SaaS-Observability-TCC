import { NextRequest, NextResponse } from 'next/server';
import { isSameOrigin } from '../../../lib/request-origin';

// Runtime proxy keeps cookies same-origin in local development and standalone Docker.
async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const route = path.join('/');
  const allowed = /^(auth\/(login|register|refresh|logout)|projects)$/.test(
    route,
  );
  if (!allowed || request.method !== 'POST')
    return new NextResponse(null, { status: 404 });
  const origin = request.headers.get('origin');
  if (
    !isSameOrigin(origin, request.headers.get('host'), request.nextUrl.protocol)
  )
    return new NextResponse(null, { status: 403 });
  try {
    const upstream = await fetch(
      `${process.env.API_URL || 'http://localhost:4000'}/api/${route}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: request.headers.get('cookie') || '',
        },
        body: await request.text(),
        cache: 'no-store',
        redirect: 'manual',
        signal: AbortSignal.timeout(15000),
      },
    );
    const response = new NextResponse(
      upstream.status === 204 ? null : await upstream.text(),
      {
        status: upstream.status,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      },
    );
    for (const cookie of upstream.headers.getSetCookie())
      response.headers.append('Set-Cookie', cookie);
    return response;
  } catch {
    return NextResponse.json(
      { message: 'API indisponível. Tente novamente.' },
      { status: 502 },
    );
  }
}
export const POST = proxy;
