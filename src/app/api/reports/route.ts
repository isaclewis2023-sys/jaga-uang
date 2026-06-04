import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { transactions, categories } from '@/lib/db/schema'
import { and, gte, lte, eq, sql } from 'drizzle-orm'
import { format, parseISO, eachMonthOfInterval } from 'date-fns'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const startDate = searchParams.get('startDate') ?? ''
    const endDate = searchParams.get('endDate') ?? ''

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate dan endDate diperlukan' }, { status: 400 })
    }

    // All transactions in range
    const rows = await db
      .select({ tx: transactions, cat: categories })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(gte(transactions.date, startDate), lte(transactions.date, endDate)))

    const txs = rows.map((r) => ({ ...r.tx, category: r.cat }))

    // Summary
    const totalIncome = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const totalExpense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

    // Monthly breakdown
    const months = eachMonthOfInterval({ start: parseISO(startDate), end: parseISO(endDate) })
    const monthly = months.map((m) => {
      const key = format(m, 'yyyy-MM')
      const mTxs = txs.filter((t) => t.date.startsWith(key))
      return {
        month: key,
        income: mTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
        expense: mTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
        net: 0,
      }
    }).map((m) => ({ ...m, net: m.income - m.expense }))

    // Category breakdown (expense)
    const catMap = new Map<string, { name: string; color: string; amount: number; count: number }>()
    txs.filter((t) => t.type === 'expense').forEach((t) => {
      const key = t.categoryId
      const existing = catMap.get(key)
      if (existing) {
        existing.amount += t.amount
        existing.count++
      } else {
        catMap.set(key, {
          name: t.category?.name ?? 'Lain-lain',
          color: t.category?.color ?? '#3a5c3a',
          amount: t.amount,
          count: 1,
        })
      }
    })
    const categoryBreakdown = Array.from(catMap.entries())
      .map(([categoryId, v]) => ({
        categoryId,
        categoryName: v.name,
        color: v.color,
        amount: v.amount,
        count: v.count,
        percentage: totalExpense > 0 ? Math.round((v.amount / totalExpense) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount)

    // Daily spending for heatmap
    const dailyMap = new Map<string, number>()
    txs.filter((t) => t.type === 'expense').forEach((t) => {
      dailyMap.set(t.date, (dailyMap.get(t.date) ?? 0) + t.amount)
    })
    const dailySpending = Array.from(dailyMap.entries()).map(([date, amount]) => ({ date, amount }))

    const numMonths = Math.max(months.length, 1)

    return NextResponse.json({
      summary: {
        totalIncome,
        totalExpense,
        net: totalIncome - totalExpense,
        avgIncomePerMonth: totalIncome / numMonths,
        avgExpensePerMonth: totalExpense / numMonths,
      },
      monthly,
      categoryBreakdown,
      dailySpending,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal mengambil laporan' }, { status: 500 })
  }
}
