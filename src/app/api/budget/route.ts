import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { budgets, categories, transactions } from '@/lib/db/schema'
import { generateId, getMonthStart, getMonthEnd } from '@/lib/utils'
import { eq, and, gte, lte } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const month = Number(searchParams.get('month') ?? new Date().getMonth() + 1)
    const year = Number(searchParams.get('year') ?? new Date().getFullYear())

    const rows = await db
      .select({ budget: budgets, category: categories })
      .from(budgets)
      .leftJoin(categories, eq(budgets.categoryId, categories.id))
      .where(and(eq(budgets.month, month), eq(budgets.year, year)))

    const startDate = getMonthStart(year, month)
    const endDate = getMonthEnd(year, month)

    const result = await Promise.all(rows.map(async ({ budget, category }) => {
      const spent = await db
        .select()
        .from(transactions)
        .where(and(
          eq(transactions.categoryId, budget.categoryId),
          eq(transactions.type, 'expense'),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        ))
      const spentAmount = spent.reduce((s, t) => s + t.amount, 0)
      return { ...budget, category, spent: spentAmount }
    }))

    return NextResponse.json(result)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal memuat anggaran' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { categoryId, amount, month, year } = await req.json()
    if (!categoryId || !amount || !month || !year) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
    }

    const id = generateId()
    const now = new Date().toISOString()

    // Upsert via batch: delete + insert atomically
    await db.batch([
      db.delete(budgets).where(and(
        eq(budgets.categoryId, categoryId),
        eq(budgets.month, month),
        eq(budgets.year, year)
      )),
      db.insert(budgets).values({
        id, categoryId,
        amount: Number(amount),
        month: Number(month),
        year: Number(year),
        createdAt: now,
        updatedAt: now,
      }),
    ])

    const [row] = await db.select().from(budgets).where(eq(budgets.id, id))
    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal membuat anggaran' }, { status: 500 })
  }
}
