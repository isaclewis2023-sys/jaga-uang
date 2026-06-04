import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { transactions, accounts } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const now = new Date().toISOString()

    const [old] = await db.select().from(transactions).where(eq(transactions.id, id))
    if (!old) return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })

    // Reverse old balance change
    const oldDelta = old.type === 'income' ? -old.amount : old.amount
    await db.update(accounts)
      .set({ balance: sql`${accounts.balance} + ${oldDelta}` })
      .where(eq(accounts.id, old.accountId))

    // Apply new
    const newAmount = Number(body.amount ?? old.amount)
    const newType = body.type ?? old.type
    const newAccountId = body.accountId ?? old.accountId
    const newDelta = newType === 'income' ? newAmount : -newAmount

    await db.update(transactions)
      .set({ ...body, amount: newAmount, updatedAt: now })
      .where(eq(transactions.id, id))

    await db.update(accounts)
      .set({ balance: sql`${accounts.balance} + ${newDelta}`, updatedAt: now })
      .where(eq(accounts.id, newAccountId))

    const [row] = await db.select().from(transactions).where(eq(transactions.id, id))
    return NextResponse.json(row)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal memperbarui transaksi' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const [tx] = await db.select().from(transactions).where(eq(transactions.id, id))
    if (!tx) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })

    // Reverse balance
    const delta = tx.type === 'income' ? -tx.amount : tx.amount
    await db.update(accounts)
      .set({ balance: sql`${accounts.balance} + ${delta}` })
      .where(eq(accounts.id, tx.accountId))

    await db.delete(transactions).where(eq(transactions.id, id))
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal menghapus transaksi' }, { status: 500 })
  }
}
