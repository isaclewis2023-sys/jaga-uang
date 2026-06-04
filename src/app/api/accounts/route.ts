import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { accounts } from '@/lib/db/schema'
import { generateId } from '@/lib/utils'
import { eq, asc } from 'drizzle-orm'

export async function GET() {
  try {
    const rows = await db.select().from(accounts).where(eq(accounts.isActive, true)).orderBy(asc(accounts.createdAt))
    return NextResponse.json(rows)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal memuat akun' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, type, balance, color, icon } = body

    if (!name || !type) return NextResponse.json({ error: 'Nama dan tipe diperlukan' }, { status: 400 })

    const id = generateId()
    const now = new Date().toISOString()
    await db.insert(accounts).values({
      id, name, type,
      balance: Number(balance ?? 0),
      color: color ?? '#00ff41',
      icon: icon ?? '🏦',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })

    const [row] = await db.select().from(accounts).where(eq(accounts.id, id))
    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal membuat akun' }, { status: 500 })
  }
}
