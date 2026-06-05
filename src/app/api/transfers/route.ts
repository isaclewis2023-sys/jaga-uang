import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { transfers, accounts } from '@/lib/db/schema'
import { generateId } from '@/lib/utils'
import { eq, sql } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  try {
    const { fromAccountId, toAccountId, amount, description, date } = await req.json()

    if (!fromAccountId || !toAccountId || !amount || !date) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
    }
    if (fromAccountId === toAccountId) {
      return NextResponse.json({ error: 'Akun asal dan tujuan tidak boleh sama' }, { status: 400 })
    }

    const id = generateId()
    const now = new Date().toISOString()
    const amt = Number(amount)

    await db.batch([
      db.insert(transfers).values({
        id, fromAccountId, toAccountId,
        amount: amt,
        description: description ?? 'Transfer',
        date,
        createdAt: now,
      }),
      db.update(accounts)
        .set({ balance: sql`${accounts.balance} - ${amt}`, updatedAt: now })
        .where(eq(accounts.id, fromAccountId)),
      db.update(accounts)
        .set({ balance: sql`${accounts.balance} + ${amt}`, updatedAt: now })
        .where(eq(accounts.id, toAccountId)),
    ])

    const [row] = await db.select().from(transfers).where(eq(transfers.id, id))
    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal transfer' }, { status: 500 })
  }
}
