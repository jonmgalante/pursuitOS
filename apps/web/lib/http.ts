import { NextResponse } from 'next/server';

export function redirectTo(request: Request, location: string): NextResponse {
  return NextResponse.redirect(new URL(location, request.url));
}

export function corsJson(data: unknown, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(data, init);
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}
