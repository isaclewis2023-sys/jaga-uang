import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { categories } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    await db.update(categories).set(body).where(eq(categories.id, id))
    const [row] = await db.select().from(categories).where(eq(categories.id, id))
    if (!row) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })
    return NextResponse.json(row)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal memperbarui' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.delete(categories).where(eq(categories.id, id))
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal menghapus' }, { status: 500 })
  }
}
