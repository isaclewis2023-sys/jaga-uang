import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { goals, accounts, transactions, categories } from '@/lib/db/schema'
import { generateId } from '@/lib/utils'
import { eq, sql } from 'drizzle-orm'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const now = new Date().toISOString()

    if (body.addFunds) {
      const amount = Number(body.addFunds)
      const accountId = body.accountId as string
      const date = body.date as string

      if (!accountId || !date) {
        return NextResponse.json({ error: 'accountId dan date wajib diisi' }, { status: 400 })
      }

      const [[goal], [account]] = await Promise.all([
        db.select().from(goals).where(eq(goals.id, id)),
        db.select().from(accounts).where(eq(accounts.id, accountId)),
      ])

      if (!goal) return NextResponse.json({ error: 'Tujuan tidak ditemukan' }, { status: 404 })
      if (!account) return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 404 })
      if (account.balance < amount) return NextResponse.json({ error: 'Saldo akun tidak cukup' }, { status: 400 })

      // Find "Tabungan" expense category, fallback to any expense category
      const allExpenseCats = await db.select().from(categories).where(eq(categories.type, 'expense'))
      const savingsCat = allExpenseCats.find((c) => c.name === 'Tabungan') ?? allExpenseCats[0]
      if (!savingsCat) return NextResponse.json({ error: 'Tidak ada kategori pengeluaran' }, { status: 400 })

      const newCurrentAmount = goal.currentAmount + amount
      const isCompleted = newCurrentAmount >= goal.targetAmount
      const txId = generateId()

      await db.batch([
        db.insert(transactions).values({
          id: txId,
          accountId,
          categoryId: savingsCat.id,
          type: 'expense',
          amount,
          description: `Tabungan: ${goal.name}`,
          date,
          notes: null,
          isRecurring: false,
          recurringId: null,
          createdAt: now,
          updatedAt: now,
        }),
        db.update(accounts)
          .set({ balance: sql`${accounts.balance} - ${amount}`, updatedAt: now })
          .where(eq(accounts.id, accountId)),
        db.update(goals)
          .set({ currentAmount: newCurrentAmount, isCompleted, updatedAt: now })
          .where(eq(goals.id, id)),
      ])

      const [updatedGoal] = await db.select().from(goals).where(eq(goals.id, id))
      return NextResponse.json({ goal: updatedGoal })
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
