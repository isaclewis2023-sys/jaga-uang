import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { settings, categories } from '@/lib/db/schema'
import { generateId, DEFAULT_CATEGORIES } from '@/lib/utils'
import { eq } from 'drizzle-orm'

export async function GET() {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, 'setup_complete'))
    return NextResponse.json({ setupComplete: row?.value === 'true' })
  } catch {
    return NextResponse.json({ setupComplete: false })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json()

    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password minimal 8 karakter' }, { status: 400 })
    }

    const [existing] = await db.select().from(settings).where(eq(settings.key, 'setup_complete'))
    if (existing?.value === 'true') {
      return NextResponse.json({ error: 'Setup sudah dilakukan' }, { status: 400 })
    }

    const hash = await bcrypt.hash(password, 12)

    await db.insert(settings).values([
      { id: generateId(), key: 'password_hash', value: hash },
      { id: generateId(), key: 'setup_complete', value: 'true' },
      { id: generateId(), key: 'language', value: 'id' },
    ])

    // Seed default categories
    const catRows = DEFAULT_CATEGORIES.map((c) => ({
      id: generateId(),
      name: c.name,
      type: c.type as 'income' | 'expense',
      color: c.color,
      icon: c.icon,
      isDefault: true,
    }))
    await db.insert(categories).values(catRows)

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 })
  }
}
