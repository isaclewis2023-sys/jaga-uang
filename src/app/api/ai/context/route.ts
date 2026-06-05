import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { accounts, transactions, budgets, goals, categories, recurringRules, transfers } from '@/lib/db/schema'
import { eq, desc, and, gte, lte } from 'drizzle-orm'

export async function GET() {
  try {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth() + 1
    const d = now.getDate()

    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
    const lastDay = new Date(y, m, 0).getDate()
    const monthEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    // Last month range
    const lmDate = new Date(y, m - 2, 1)
    const lmY = lmDate.getFullYear()
    const lmM = lmDate.getMonth() + 1
    const lastMonthStart = `${lmY}-${String(lmM).padStart(2, '0')}-01`
    const lastMonthLastDay = new Date(lmY, lmM, 0).getDate()
    const lastMonthEnd = `${lmY}-${String(lmM).padStart(2, '0')}-${String(lastMonthLastDay).padStart(2, '0')}`

    // 3 months ago start
    const threeMonthsAgo = new Date(y, m - 4, 1)
    const tmY = threeMonthsAgo.getFullYear()
    const tmM = threeMonthsAgo.getMonth() + 1
    const threeMonthsAgoStart = `${tmY}-${String(tmM).padStart(2, '0')}-01`

    // Upcoming recurring: nextDue within 7 days
    const sevenDaysLater = new Date(y, m - 1, d + 7)
    const sevenDaysLaterStr = `${sevenDaysLater.getFullYear()}-${String(sevenDaysLater.getMonth() + 1).padStart(2, '0')}-${String(sevenDaysLater.getDate()).padStart(2, '0')}`
    const todayStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

    const [
      allAccounts, recentTx, monthTx, lastMonthTx, historicalTx,
      allBudgets, allGoals, allCategories, allRecurring, recentTransfers,
    ] = await Promise.all([
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
      db.select().from(transactions)
        .where(and(gte(transactions.date, lastMonthStart), lte(transactions.date, lastMonthEnd)))
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .limit(200),
      db.select().from(transactions)
        .where(and(gte(transactions.date, threeMonthsAgoStart), lte(transactions.date, monthEnd)))
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .limit(500),
      db.select().from(budgets).where(and(eq(budgets.month, m), eq(budgets.year, y)))
        .leftJoin(categories, eq(budgets.categoryId, categories.id)),
      db.select().from(goals),
      db.select().from(categories),
      db.select().from(recurringRules)
        .leftJoin(accounts, eq(recurringRules.accountId, accounts.id))
        .leftJoin(categories, eq(recurringRules.categoryId, categories.id)),
      db.select().from(transfers)
        .leftJoin(accounts, eq(transfers.fromAccountId, accounts.id))
        .orderBy(desc(transfers.date))
        .limit(10),
    ])

    const netWorth = allAccounts.reduce((s, a) => s + (a.type === 'credit' ? -a.balance : a.balance), 0)
    const monthIncome = monthTx.filter(r => r.transactions.type === 'income').reduce((s, r) => s + r.transactions.amount, 0)
    const monthExpense = monthTx.filter(r => r.transactions.type === 'expense').reduce((s, r) => s + r.transactions.amount, 0)
    const savingsRate = monthIncome > 0 ? Math.round(((monthIncome - monthExpense) / monthIncome) * 100) : 0

    // Last month stats
    const lastMonthIncome = lastMonthTx.filter(r => r.transactions.type === 'income').reduce((s, r) => s + r.transactions.amount, 0)
    const lastMonthExpense = lastMonthTx.filter(r => r.transactions.type === 'expense').reduce((s, r) => s + r.transactions.amount, 0)

    // Average daily expense this month
    const avgDailyExpense = d > 0 ? Math.round(monthExpense / d) : 0
    const daysLeftInMonth = lastDay - d

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

    // Historical: group by month (last 3 months)
    const monthlyHistory: Record<string, { label: string; income: number; expense: number }> = {}
    historicalTx.forEach(r => {
      const dateStr = r.transactions.date
      const [hy, hm] = dateStr.split('-')
      const key = `${hy}-${hm}`
      if (!monthlyHistory[key]) {
        const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des']
        monthlyHistory[key] = { label: `${monthNames[parseInt(hm) - 1]} ${hy}`, income: 0, expense: 0 }
      }
      if (r.transactions.type === 'income') monthlyHistory[key].income += r.transactions.amount
      else monthlyHistory[key].expense += r.transactions.amount
    })
    const last3MonthsHistory = Object.entries(monthlyHistory)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v)

    // Upcoming recurring (nextDue within 7 days)
    const upcomingRecurring = allRecurring
      .filter(r => r.recurring_rules.isActive && r.recurring_rules.nextDue >= todayStr && r.recurring_rules.nextDue <= sevenDaysLaterStr)
      .map(r => ({
        description: r.recurring_rules.description,
        amount: r.recurring_rules.amount,
        type: r.recurring_rules.type,
        nextDue: r.recurring_rules.nextDue,
        category: r.categories?.name ?? '',
        account: r.accounts?.name ?? '',
      }))

    // Recent transfers (with account names — need second join for toAccount)
    // We only joined fromAccount above; get toAccount names from allAccounts
    const accountMap = Object.fromEntries(allAccounts.map(a => [a.id, a.name]))
    const recentTransfersMapped = recentTransfers.map(r => ({
      date: r.transfers.date,
      amount: r.transfers.amount,
      description: r.transfers.description,
      fromAccount: r.accounts?.name ?? accountMap[r.transfers.fromAccountId] ?? r.transfers.fromAccountId,
      toAccount: accountMap[r.transfers.toAccountId] ?? r.transfers.toAccountId,
    }))

    return NextResponse.json({
      today: todayStr,
      daysLeftInMonth,
      netWorth,
      monthIncome,
      monthExpense,
      monthNet: monthIncome - monthExpense,
      savingsRate,
      lastMonthIncome,
      lastMonthExpense,
      lastMonthNet: lastMonthIncome - lastMonthExpense,
      avgDailyExpense,
      projectedMonthExpense: avgDailyExpense * lastDay,
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
      recurringRules: allRecurring.map(r => ({
        description: r.recurring_rules.description,
        amount: r.recurring_rules.amount,
        type: r.recurring_rules.type,
        frequency: r.recurring_rules.frequency,
        nextDue: r.recurring_rules.nextDue,
        endDate: r.recurring_rules.endDate,
        isActive: Boolean(r.recurring_rules.isActive),
        category: r.categories?.name ?? '',
        account: r.accounts?.name ?? '',
      })),
      upcomingRecurring,
      recentTransfers: recentTransfersMapped,
      last3MonthsHistory,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal memuat konteks' }, { status: 500 })
  }
}
