import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { settings } from '@/lib/db/schema'
import { signToken } from '@/lib/auth'
import { eq } from 'drizzle-orm'

const COOKIE_NAME = 'jaga-uang-token'

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json()

    if (!password) {
      return NextResponse.json({ error: 'Password diperlukan' }, { status: 400 })
    }

    const [hashRow] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'password_hash'))

    if (!hashRow) {
      return NextResponse.json({ error: 'Sistem belum diinisialisasi' }, { status: 400 })
    }

    const valid = await bcrypt.compare(password, hashRow.value)
    if (!valid) {
      return NextResponse.json({ error: 'Password salah' }, { status: 401 })
    }

    const token = await signToken('user')

    const res = NextResponse.json({ success: true })
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    return res
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 })
  }
}
