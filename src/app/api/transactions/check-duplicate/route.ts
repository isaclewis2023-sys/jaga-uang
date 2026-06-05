import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { transactions, categories } from '@/lib/db/schema'
import { and, eq, gte, lte, sql } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const amount = Number(searchParams.get('amount'))
    const description = searchParams.get('description') ?? ''
    const date = searchParams.get('date') ?? ''
    const excludeId = searchParams.get('excludeId')

    if (!amount || !description || !date) {
      return NextResponse.json([])
    }

    // Check within ±3 days of given date
    const d = new Date(date)
    const from = new Date(d)
    from.setDate(from.getDate() - 3)
    const to = new Date(d)
    to.setDate(to.getDate() + 3)

    const fromStr = from.toISOString().split('T')[0]
    const toStr = to.toISOString().split('T')[0]

    const rows = await db
      .select({ transaction: transactions, category: categories })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.amount, amount),
          gte(transactions.date, fromStr),
          lte(transactions.date, toStr),
          sql`lower(${transactions.description}) = lower(${description})`
        )
      )
      .limit(3)

    const results = rows
      .map((r) => ({ ...r.transaction, category: r.category }))
      .filter((r) => r.id !== excludeId)

    return NextResponse.json(results)
  } catch (e) {
    console.error(e)
    return NextResponse.json([])
  }
}
