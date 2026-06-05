import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { transactions, accounts, transfers } from '@/lib/db/schema'
import { asc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Fetch all accounts, all transactions, all transfers (full history for running balance)
    const [allAccounts, allTx, allTransfers] = await Promise.all([
      db.select().from(accounts),
      db.select().from(transactions).orderBy(asc(transactions.date), asc(transactions.createdAt)),
      db.select().from(transfers).orderBy(asc(transfers.date), asc(transfers.createdAt)),
    ])

    // Build a set of all dates that have activity
    const dateSet = new Set<string>()
    allTx.forEach((t) => dateSet.add(t.date))
    allTransfers.forEach((t) => dateSet.add(t.date))

    // Determine date range to output
    const allDates = Array.from(dateSet).sort()
    if (allDates.length === 0) return NextResponse.json([])

    const rangeStart = startDate ?? allDates[0]
    const rangeEnd = endDate ?? allDates[allDates.length - 1]

    // Running balances per account starting from 0
    const balances: Record<string, number> = {}
    allAccounts.forEach((a) => { balances[a.id] = 0 })

    // Collect all events sorted by date
    type Event = { date: string; accountId: string; delta: number }
    const events: Event[] = []

    allTx.forEach((t) => {
      const delta = t.type === 'income' ? t.amount : -t.amount
      events.push({ date: t.date, accountId: t.accountId, delta })
    })
    allTransfers.forEach((t) => {
      events.push({ date: t.date, accountId: t.fromAccountId, delta: -t.amount })
      events.push({ date: t.date, accountId: t.toAccountId, delta: t.amount })
    })
    events.sort((a, b) => a.date.localeCompare(b.date))

    // Walk through events and snapshot net worth on each activity date
    const snapshots: Array<{ date: string; netWorth: number; breakdown: Record<string, number> }> = []

    let eventIdx = 0
    // Generate one snapshot per unique date that falls within range
    const outputDates = Array.from(dateSet).filter((d) => d >= rangeStart && d <= rangeEnd).sort()

    // Process all events up to and including each output date
    for (const date of outputDates) {
      while (eventIdx < events.length && events[eventIdx].date <= date) {
        const ev = events[eventIdx]
        if (balances[ev.accountId] !== undefined) {
          balances[ev.accountId] += ev.delta
        }
        eventIdx++
      }

      const breakdown: Record<string, number> = {}
      let netWorth = 0
      allAccounts.forEach((a) => {
        const bal = balances[a.id] ?? 0
        breakdown[a.id] = bal
        netWorth += a.type === 'credit' ? -bal : bal
      })

      snapshots.push({ date, netWorth, breakdown })
    }

    // Attach account names to breakdown keys for convenience
    const accountMap = Object.fromEntries(allAccounts.map((a) => [a.id, { name: a.name, icon: a.icon, type: a.type }]))

    return NextResponse.json({ snapshots, accounts: accountMap })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal memuat riwayat kekayaan' }, { status: 500 })
  }
}
