import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { transactions, accounts, categories } from '@/lib/db/schema'
import { generateId } from '@/lib/utils'
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const accountId = searchParams.get('accountId')
    const categoryId = searchParams.get('categoryId')
    const type = searchParams.get('type')
    const limit = Number(searchParams.get('limit') ?? '100')
    const offset = Number(searchParams.get('offset') ?? '0')

    const conditions = []
    if (startDate) conditions.push(gte(transactions.date, startDate))
    if (endDate) conditions.push(lte(transactions.date, endDate))
    if (accountId) conditions.push(eq(transactions.accountId, accountId))
    if (categoryId) conditions.push(eq(transactions.categoryId, categoryId))
    if (type) conditions.push(eq(transactions.type, type as 'income' | 'expense'))

    const rows = await db
      .select({
        transaction: transactions,
        account: accounts,
        category: categories,
      })
      .from(transactions)
      .leftJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(transactions.date), desc(transactions.createdAt))
      .limit(limit)
      .offset(offset)

    const result = rows.map((r) => ({
      ...r.transaction,
      account: r.account,
      category: r.category,
    }))

    return NextResponse.json(result)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal memuat transaksi' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { accountId, categoryId, type, amount, description, date, notes } = body

    if (!accountId || !categoryId || !type || !amount || !description || !date) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
    }

    const id = generateId()
    const now = new Date().toISOString()

    await db.insert(transactions).values({
      id, accountId, categoryId, type,
      amount: Number(amount),
      description,
      date,
      notes: notes ?? null,
      isRecurring: false,
      recurringId: null,
      createdAt: now,
      updatedAt: now,
    })

    // Update account balance
    const delta = type === 'income' ? Number(amount) : -Number(amount)
    await db.update(accounts)
      .set({ balance: sql`${accounts.balance} + ${delta}`, updatedAt: now })
      .where(eq(accounts.id, accountId))

    const [row] = await db
      .select({ transaction: transactions, account: accounts, category: categories })
      .from(transactions)
      .leftJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.id, id))

    return NextResponse.json({ ...row.transaction, account: row.account, category: row.category }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal membuat transaksi' }, { status: 500 })
  }
}
