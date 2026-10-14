import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as jose from 'jose';

// Token dianggap valid hanya jika tanda tangan & masa berlakunya lolos verifikasi.
// Cookie yang sekadar "ada" (kadaluarsa / beda JWT_SECRET) dulu membuat
// redirect loop: middleware lempar /login -> /, halaman lempar / -> /login.
async function isValidToken(token: string): Promise<boolean> {
  const secret = process.env.JWT_SECRET;
  if (!secret) return false;
  try {
    await jose.jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const isLoggedIn = token ? await isValidToken(token) : false;

  const isLoginPage = request.nextUrl.pathname.startsWith('/login');

  if (!isLoggedIn && !isLoginPage) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    if (token) response.cookies.delete('auth_token');
    return response;
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const response = NextResponse.next();
  if (token && !isLoggedIn) response.cookies.delete('auth_token');
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - uploads (uploaded files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|uploads).*)',
  ],
};
