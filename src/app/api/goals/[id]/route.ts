import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { goals } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const now = new Date().toISOString()

    if (body.addFunds) {
      const amount = Number(body.addFunds)
      const [goal] = await db.select().from(goals).where(eq(goals.id, id))
      if (!goal) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })
      const newAmount = goal.currentAmount + amount
      const isCompleted = newAmount >= goal.targetAmount
      await db.update(goals).set({ currentAmount: newAmount, isCompleted, updatedAt: now }).where(eq(goals.id, id))
    } else {
      await db.update(goals).set({ ...body, updatedAt: now }).where(eq(goals.id, id))
    }

    const [row] = await db.select().from(goals).where(eq(goals.id, id))
    if (!row) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })
    return NextResponse.json(row)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal memperbarui tujuan' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.delete(goals).where(eq(goals.id, id))
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal menghapus tujuan' }, { status: 500 })
  }
}
