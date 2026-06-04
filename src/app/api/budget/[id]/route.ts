import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { budgets } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.delete(budgets).where(eq(budgets.id, id))
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal menghapus anggaran' }, { status: 500 })
  }
}
