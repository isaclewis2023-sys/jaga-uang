import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { accounts, transactions, budgets, goals } from '@/lib/db/schema'
import { eq, gte, lte, and } from 'drizzle-orm'
import { getMonthStart, getMonthEnd, getHealthLabel, getHealthColor } from '@/lib/utils'

export async function GET() {
  try {
    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()
    const startDate = getMonthStart(year, month)
    const endDate = getMonthEnd(year, month)

    const [allAccounts, monthTxs, allBudgets, allGoals] = await Promise.all([
      db.select().from(accounts).where(eq(accounts.isActive, true)),
      db.select().from(transactions).where(
        and(gte(transactions.date, startDate), lte(transactions.date, endDate))
      ),
      db.select().from(budgets).where(and(eq(budgets.month, month), eq(budgets.year, year))),
      db.select().from(goals),
    ])

    const income = monthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = monthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

    // 1. Savings rate score (30 pts)
    const savingsRate = income > 0 ? (income - expense) / income : 0
    let savingsScore = 0
    if (savingsRate >= 0.3) savingsScore = 30
    else if (savingsRate >= 0.2) savingsScore = 22
    else if (savingsRate >= 0.1) savingsScore = 14
    else if (savingsRate >= 0) savingsScore = 5

    // 2. Budget adherence (25 pts)
    let budgetScore = 25
    if (allBudgets.length > 0) {
      // Pre-compute spending per category in a single pass to avoid N+1 filtering
      const spentByCategory = new Map<string, number>()
      for (const t of monthTxs) {
        if (t.type === 'expense' && t.categoryId) {
          spentByCategory.set(t.categoryId, (spentByCategory.get(t.categoryId) ?? 0) + t.amount)
        }
      }
      const onBudget = allBudgets.filter((b) => (spentByCategory.get(b.categoryId) ?? 0) <= b.amount).length
      const ratio = onBudget / allBudgets.length
      budgetScore = Math.round(25 * ratio)
    }

    // 3. Emergency fund (25 pts)
    const liquidBalance = allAccounts
      .filter((a) => ['cash', 'savings', 'bank'].includes(a.type))
      .reduce((s, a) => s + Math.max(0, a.balance), 0)
    const monthlyExpense = expense || 1
    const months = liquidBalance / monthlyExpense
    let emergencyScore = 0
    if (months >= 6) emergencyScore = 25
    else if (months >= 3) emergencyScore = 18
    else if (months >= 1) emergencyScore = 10
    else emergencyScore = 3

    // 4. Goal progress (20 pts)
    const activeGoals = allGoals.filter((g) => !g.isCompleted)
    let goalScore = 0
    if (activeGoals.length === 0) {
      goalScore = 20
    } else {
      const avgProgress = activeGoals.reduce(
        (s, g) => s + Math.min(1, g.currentAmount / g.targetAmount), 0
      ) / activeGoals.length
      goalScore = Math.round(20 * avgProgress)
    }

    const total = savingsScore + budgetScore + emergencyScore + goalScore

    return NextResponse.json({
      total,
      label: getHealthLabel(total),
      color: getHealthColor(total),
      savingsRate: Math.round(savingsRate * 100),
      savingsScore,
      budgetScore,
      emergencyScore,
      goalScore,
      emergencyMonths: Math.round(months * 10) / 10,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal kalkulasi skor' }, { status: 500 })
  }
}
