import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { accounts, categories, transactions, transfers, budgets, goals, recurringRules } from '@/lib/db/schema'

export async function GET() {
  try {
    const [accs, cats, txs, trs, bds, gls, rcs] = await Promise.all([
      db.select().from(accounts),
      db.select().from(categories),
      db.select().from(transactions),
      db.select().from(transfers),
      db.select().from(budgets),
      db.select().from(goals),
      db.select().from(recurringRules),
    ])

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      data: {
        accounts: accs,
        categories: cats,
        transactions: txs,
        transfers: trs,
        budgets: bds,
        goals: gls,
        recurringRules: rcs,
      },
    }

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="jaga-uang-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal export' }, { status: 500 })
  }
}
