import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { goals } from '@/lib/db/schema'
import { generateId } from '@/lib/utils'
import { asc, eq } from 'drizzle-orm'

export async function GET() {
  try {
    const rows = await db.select().from(goals).orderBy(asc(goals.createdAt))
    return NextResponse.json(rows)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal memuat tujuan' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, targetAmount, currentAmount, deadline, color, icon, description } = await req.json()
    if (!name || !targetAmount) return NextResponse.json({ error: 'Nama dan target diperlukan' }, { status: 400 })

    const id = generateId()
    const now = new Date().toISOString()
    await db.insert(goals).values({
      id, name,
      targetAmount: Number(targetAmount),
      currentAmount: Number(currentAmount ?? 0),
      deadline: deadline ?? null,
      color: color ?? '#00ff41',
      icon: icon ?? '🎯',
      description: description ?? null,
      isCompleted: false,
      createdAt: now,
      updatedAt: now,
    })

    const [row] = await db.select().from(goals).where(eq(goals.id, id))
    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal membuat tujuan' }, { status: 500 })
  }
}
