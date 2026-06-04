import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { settings } from '@/lib/db/schema'
import bcrypt from 'bcryptjs'
import { generateId } from '@/lib/utils'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  try {
    const { action, currentPassword, newPassword } = await req.json()

    if (action === 'change-password') {
      const [hashRow] = await db.select().from(settings).where(eq(settings.key, 'password_hash'))
      if (!hashRow) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 400 })

      const valid = await bcrypt.compare(currentPassword, hashRow.value)
      if (!valid) return NextResponse.json({ error: 'Password saat ini salah' }, { status: 401 })

      if (!newPassword || newPassword.length < 8) {
        return NextResponse.json({ error: 'Password baru minimal 8 karakter' }, { status: 400 })
      }

      const hash = await bcrypt.hash(newPassword, 12)
      await db.update(settings).set({ value: hash }).where(eq(settings.key, 'password_hash'))
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Action tidak dikenal' }, { status: 400 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal' }, { status: 500 })
  }
}
