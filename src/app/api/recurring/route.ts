import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { recurringRules, accounts, categories, transactions } from '@/lib/db/schema'
import { generateId } from '@/lib/utils'
import { eq, lte, sql } from 'drizzle-orm'
import { addDays, addWeeks, addMonths, addYears, format, parseISO } from 'date-fns'

function getNextDue(current: string, frequency: string): string {
  const d = parseISO(current)
  let next: Date
  switch (frequency) {
    case 'daily': next = addDays(d, 1); break
    case 'weekly': next = addWeeks(d, 1); break
    case 'monthly': next = addMonths(d, 1); break
    case 'yearly': next = addYears(d, 1); break
    default: next = addMonths(d, 1)
  }
  return format(next, 'yyyy-MM-dd')
}

export async function GET() {
  try {
    const rows = await db
      .select({ rule: recurringRules, account: accounts, category: categories })
      .from(recurringRules)
      .leftJoin(accounts, eq(recurringRules.accountId, accounts.id))
      .leftJoin(categories, eq(recurringRules.categoryId, categories.id))
    return NextResponse.json(rows.map((r) => ({ ...r.rule, account: r.account, category: r.category })))
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal memuat' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { accountId, categoryId, type, amount, description, frequency, startDate, endDate } = await req.json()
    if (!accountId || !categoryId || !type || !amount || !frequency || !startDate) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
    }

    const id = generateId()
    const now = new Date().toISOString()
    await db.insert(recurringRules).values({
      id, accountId, categoryId, type,
      amount: Number(amount),
      description: description ?? '',
      frequency,
      startDate,
      endDate: endDate ?? null,
      nextDue: startDate,
      isActive: true,
      createdAt: now,
    })

    const [row] = await db.select().from(recurringRules).where(eq(recurringRules.id, id))
    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal membuat' }, { status: 500 })
  }
}

// Process due recurring transactions
export async function PUT() {
  try {
    const today = format(new Date(), 'yyyy-MM-dd')
    const due = await db
      .select()
      .from(recurringRules)
      .where(lte(recurringRules.nextDue, today))

    const processed = []
    const errors = []
    for (const rule of due) {
      if (!rule.isActive) continue
      if (rule.endDate && rule.nextDue > rule.endDate) continue

      try {
        const txId = generateId()
        const now = new Date().toISOString()
        const delta = rule.type === 'income' ? rule.amount : -rule.amount
        const nextDue = getNextDue(rule.nextDue, rule.frequency)

        await db.batch([
          db.insert(transactions).values({
            id: txId,
            accountId: rule.accountId,
            categoryId: rule.categoryId,
            type: rule.type,
            amount: rule.amount,
            description: rule.description,
            date: rule.nextDue,
            notes: 'Transaksi berulang otomatis',
            isRecurring: true,
            recurringId: rule.id,
            createdAt: now,
            updatedAt: now,
          }),
          db.update(accounts)
            .set({ balance: sql`${accounts.balance} + ${delta}` })
            .where(eq(accounts.id, rule.accountId)),
          db.update(recurringRules).set({ nextDue }).where(eq(recurringRules.id, rule.id)),
        ])

        processed.push(rule.id)
      } catch (err) {
        console.error(`Failed to process recurring rule ${rule.id}:`, err)
        errors.push(rule.id)
      }
    }

    return NextResponse.json({ processed: processed.length, errors: errors.length })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal memproses recurring' }, { status: 500 })
  }
}
