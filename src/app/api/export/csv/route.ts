import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { transactions, accounts, categories } from '@/lib/db/schema'
import { eq, desc, and, gte, lte } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const format = searchParams.get('format') ?? 'csv'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const type = searchParams.get('type')

    const conditions = []
    if (startDate) conditions.push(gte(transactions.date, startDate))
    if (endDate) conditions.push(lte(transactions.date, endDate))
    if (type && type !== 'all') conditions.push(eq(transactions.type, type as 'income' | 'expense'))

    const rows = await db
      .select({ transaction: transactions, account: accounts, category: categories })
      .from(transactions)
      .leftJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(transactions.date), desc(transactions.createdAt))
      .limit(10000)

    const data = rows.map((r) => ({
      Tanggal: r.transaction.date,
      Deskripsi: r.transaction.description,
      Kategori: r.category?.name ?? '',
      Akun: r.account?.name ?? '',
      Tipe: r.transaction.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      Jumlah: r.transaction.amount,
      Catatan: r.transaction.notes ?? '',
    }))

    const suffix = startDate ? startDate.slice(0, 7) : new Date().toISOString().slice(0, 7)

    if (format === 'xlsx') {
      const XLSX = await import('xlsx')
      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Transaksi')
      ws['!cols'] = [
        { wch: 12 }, { wch: 32 }, { wch: 18 }, { wch: 18 },
        { wch: 12 }, { wch: 16 }, { wch: 32 },
      ]
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="jaga-uang-transaksi-${suffix}.xlsx"`,
        },
      })
    }

    // CSV
    const headers = Object.keys(data[0] ?? {})
    const csvRows = [
      headers.join(','),
      ...data.map((row) =>
        headers.map((h) => {
          const val = String((row as Record<string, string | number>)[h] ?? '')
          return val.includes(',') || val.includes('"') || val.includes('\n')
            ? `"${val.replace(/"/g, '""')}"`
            : val
        }).join(',')
      ),
    ]
    const csv = '﻿' + csvRows.join('\r\n') // BOM for Excel UTF-8 compatibility

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="jaga-uang-transaksi-${suffix}.csv"`,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal export' }, { status: 500 })
  }
}
