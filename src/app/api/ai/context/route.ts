import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { accounts, transactions, budgets, goals, categories } from '@/lib/db/schema'
import { eq, desc, and, gte, lte } from 'drizzle-orm'

export async function GET() {
  try {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() + 1
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
    const lastDay = new Date(y, m, 0).getDate()
    const monthEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const [allAccounts, recentTx, monthTx, allBudgets, allGoals, allCategories] = await Promise.all([
      db.select().from(accounts).where(eq(accounts.isActive, true)),
      db.select().from(transactions)
        .leftJoin(accounts, eq(transactions.accountId, accounts.id))
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .orderBy(desc(transactions.date), desc(transactions.createdAt))
        .limit(30),
      db.select().from(transactions)
        .where(and(gte(transactions.date, monthStart), lte(transactions.date, monthEnd)))
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .limit(200),
      db.select().from(budgets).where(and(eq(budgets.month, m), eq(budgets.year, y)))
        .leftJoin(categories, eq(budgets.categoryId, categories.id)),
      db.select().from(goals),
      db.select().from(categories),
    ])

    const netWorth = allAccounts.reduce((s, a) => s + (a.type === 'credit' ? -a.balance : a.balance), 0)
    const monthIncome = monthTx.filter(r => r.transactions.type === 'income').reduce((s, r) => s + r.transactions.amount, 0)
    const monthExpense = monthTx.filter(r => r.transactions.type === 'expense').reduce((s, r) => s + r.transactions.amount, 0)
    const savingsRate = monthIncome > 0 ? Math.round(((monthIncome - monthExpense) / monthIncome) * 100) : 0

    // Top expense categories this month
    const catSpend: Record<string, { name: string; amount: number }> = {}
    monthTx.filter(r => r.transactions.type === 'expense').forEach(r => {
      const cname = r.categories?.name ?? 'Lain-lain'
      const cid = r.transactions.categoryId
      if (!catSpend[cid]) catSpend[cid] = { name: cname, amount: 0 }
      catSpend[cid].amount += r.transactions.amount
    })
    const topCategories = Object.values(catSpend).sort((a, b) => b.amount - a.amount).slice(0, 5)

    // Budget with spent
    const budgetData = allBudgets.map(b => {
      const spent = monthTx
        .filter(r => r.transactions.type === 'expense' && r.transactions.categoryId === b.budgets.categoryId)
        .reduce((s, r) => s + r.transactions.amount, 0)
      return {
        category: b.categories?.name ?? '',
        limit: b.budgets.amount,
        spent,
        pct: b.budgets.amount > 0 ? Math.round((spent / b.budgets.amount) * 100) : 0,
      }
    })

    return NextResponse.json({
      today: `${y}-${String(m).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
      netWorth,
      monthIncome,
      monthExpense,
      monthNet: monthIncome - monthExpense,
      savingsRate,
      accounts: allAccounts.map(a => ({ id: a.id, name: a.name, type: a.type, balance: a.balance, icon: a.icon })),
      recentTransactions: recentTx.slice(0, 20).map(r => ({
        date: r.transactions.date,
        description: r.transactions.description,
        amount: r.transactions.amount,
        type: r.transactions.type,
        category: r.categories?.name ?? '',
        account: r.accounts?.name ?? '',
      })),
      budgets: budgetData,
      goals: allGoals.map(g => ({
        name: g.name,
        target: g.targetAmount,
        current: g.currentAmount,
        pct: Math.round((g.currentAmount / g.targetAmount) * 100),
        deadline: g.deadline,
        isCompleted: g.isCompleted,
      })),
      topExpenseCategories: topCategories,
      categories: allCategories.map(c => ({ id: c.id, name: c.name, type: c.type, icon: c.icon })),
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal memuat konteks' }, { status: 500 })
  }
}
