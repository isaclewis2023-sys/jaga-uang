import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { accounts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const now = new Date().toISOString()

    // Only allow safe fields — balance is managed by transactions, isActive by DELETE
    const { name, type, icon, color, description } = body
    const allowed: Record<string, unknown> = {}
    if (name !== undefined) allowed.name = name
    if (type !== undefined) allowed.type = type
    if (icon !== undefined) allowed.icon = icon
    if (color !== undefined) allowed.color = color
    if (description !== undefined) allowed.description = description

    const [existing] = await db.select().from(accounts).where(eq(accounts.id, id))
    if (!existing) return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 404 })

    await db.update(accounts)
      .set({ ...allowed, updatedAt: now })
      .where(eq(accounts.id, id))

    const [row] = await db.select().from(accounts).where(eq(accounts.id, id))
    return NextResponse.json(row)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal memperbarui akun' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.update(accounts).set({ isActive: false }).where(eq(accounts.id, id))
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal menghapus akun' }, { status: 500 })
  }
}
