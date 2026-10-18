import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import * as jose from 'jose';

export async function POST(req: Request) {
  // Tanpa JWT_SECRET jangan pernah menandatangani token (dulu ada kunci cadangan
  // yang tertulis di kode, sehingga token bisa dipalsukan).
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Server auth is not configured' }, { status: 500 });
  }
  const JWT_SECRET = new TextEncoder().encode(secret);

  try {
    const { email, password } = await req.json();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const alg = 'HS256';
    const token = await new jose.SignJWT({ id: user.id, email: user.email, role: user.role, name: user.name, department: user.department })
      .setProtectedHeader({ alg })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(JWT_SECRET);

    const response = NextResponse.json({ success: true, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
    
    // Set HTTP Only cookie
    response.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 // 24 hours
    });

    return response;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
