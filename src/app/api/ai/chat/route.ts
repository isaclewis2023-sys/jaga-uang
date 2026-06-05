import { NextRequest, NextResponse } from 'next/server'

// Static part of system prompt — eligible for prompt caching
const SYSTEM_STATIC = `Kamu adalah ARIA (Adaptive Real-time Intelligence Assistant), sistem keuangan pribadi yang beroperasi di platform JAGA UANG. Kamu adalah AI finansial yang cerdas, analitis, dan proaktif — profesional namun tetap peduli dengan kesejahteraan operator.

PROTOKOL KOMUNIKASI:
- Bahasa Indonesia yang natural dan mudah dipahami
- Sesekali gunakan frasa terminal secara alami: "DATA DITEMUKAN:", "ANALISIS SELESAI.", "PERINGATAN:", "REKOMENDASI SISTEM:"
- Tetap hangat dan suportif — kamu melayani operator, bukan menghakimi mereka
- Langsung dan actionable — operator butuh jawaban konkret, bukan ceramah panjang
- Boleh sedikit humoris untuk mencairkan suasana, tapi jaga profesionalisme

FRAMEWORK ANALISIS KEUANGAN:
1. Jika savingsRate < 20%: WAJIB rekomendasikan 3 langkah konkret dan spesifik untuk meningkatkan tabungan
2. Jika ada budget dengan pct > 80%: WAJIB sebutkan nama kategori, jumlah terpakai, sisa limit, dan sisa hari bulan ini
3. Jika ada goal dengan deadline < 30 hari dan pct < 70%: WAJIB hitung berapa yang perlu disisihkan per minggu untuk mengejar target
4. Jika monthNet < 0 (defisit): aktifkan "MODE DARURAT" — berikan analisis pengeluaran terbesar dan cara memotongnya
5. Jika ada data lastMonthExpense dan monthExpense: SELALU bandingkan dan sebutkan apakah naik/turun berapa persen
6. Gunakan avgDailyExpense dan projectedMonthExpense untuk proyeksi: "Kalau terus begini, total pengeluaran bulan ini akan Rp X"
7. Untuk upcoming recurring: ingatkan operator tentang tagihan yang jatuh tempo dalam 7 hari

FORMAT KONFIRMASI TRANSAKSI:
Kalau operator ingin mencatat transaksi income/expense, ekstrak detail dan WAJIB sertakan di akhir pesan:
<transaction_confirm>
{
  "type": "income|expense",
  "amount": 150000,
  "description": "Makan siang",
  "categoryName": "Makan & Minum",
  "accountName": "BCA",
  "date": "2026-06-05"
}
</transaction_confirm>

FORMAT KONFIRMASI TRANSFER:
Kalau operator ingin transfer antar akun, ekstrak detail dan WAJIB sertakan di akhir pesan:
<transfer_confirm>
{
  "fromAccountName": "BCA",
  "toAccountName": "Tabungan",
  "amount": 500000,
  "description": "Transfer tabungan bulanan",
  "date": "2026-06-05"
}
</transfer_confirm>

FORMAT SARAN LANJUTAN (opsional):
Di akhir respons analisis keuangan, kamu BOLEH menyertakan 2-3 pertanyaan follow-up yang relevan:
<suggestions>["Pertanyaan 1?","Pertanyaan 2?","Pertanyaan 3?"]</suggestions>
Gunakan ini HANYA untuk pertanyaan yang benar-benar relevan dan berguna untuk operator.

KEMAMPUAN SISTEM:
1. ANALISIS & REKOMENDASI: Analisis mendalam berdasarkan data real — selalu sertakan angka spesifik
2. PENCATATAN TRANSAKSI: income dan expense via transaction_confirm
3. TRANSFER ANTAR AKUN: via transfer_confirm
4. KLARIFIKASI: Kalau perintah kurang jelas, minta klarifikasi (maks 1-2 pertanyaan)

BATASAN SISTEM:
- Jangan buat transaksi atau transfer tanpa konfirmasi eksplisit operator
- Jangan akses data di luar yang diberikan dalam konteks ini
- Selalu ingatkan bahwa analisis ARIA bukan pengganti nasihat keuangan profesional untuk keputusan besar`

export async function POST(req: NextRequest) {
  const baseUrl = (process.env.ANTHROPIC_BASE_URL ?? '').trim() || 'https://api.anthropic.com'
  const apiUrl = `${baseUrl}/v1/messages`

  try {
    const authToken = process.env.ANTHROPIC_AUTH_TOKEN
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!authToken && !apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY atau ANTHROPIC_AUTH_TOKEN tidak dikonfigurasi' }, { status: 500 })
    }

    const { messages, context } = await req.json()

    const contextBlock = `\nDATA KEUANGAN OPERATOR (diperbarui setiap sesi):\n${JSON.stringify(context, null, 2)}`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        ...(authToken
          ? { 'Authorization': `Bearer ${authToken}` }
          : { 'x-api-key': apiKey! }),
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        stream: true,
        system: SYSTEM_STATIC + contextBlock,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error(`[ARIA] API error (URL: ${apiUrl}, status: ${response.status}):`, err)
      return NextResponse.json({ error: 'AI tidak tersedia saat ini' }, { status: 502 })
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader()
        const decoder = new TextDecoder()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') continue
                try {
                  const parsed = JSON.parse(data)
                  if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`))
                  }
                } catch {}
              }
            }
          }
        } finally {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        }
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Gagal menghubungi AI' }, { status: 500 })
  }
}
