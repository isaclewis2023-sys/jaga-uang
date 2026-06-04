import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { categories } from '@/lib/db/schema'
import { generateId } from '@/lib/utils'
import { asc, eq } from 'drizzle-orm'

export async function GET() {
  try {
    const rows = await db.select().from(categories).orderBy(asc(categories.type), asc(categories.name))
    return NextResponse.json(rows)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal memuat kategori' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, type, color, icon } = await req.json()
    if (!name || !type) return NextResponse.json({ error: 'Nama dan tipe diperlukan' }, { status: 400 })

    const id = generateId()
    await db.insert(categories).values({
      id, name, type,
      color: color ?? '#00ff41',
      icon: icon ?? '📂',
      isDefault: false,
      createdAt: new Date().toISOString(),
    })

    const [row] = await db.select().from(categories).where(eq(categories.id, id))
    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal membuat kategori' }, { status: 500 })
  }
}
