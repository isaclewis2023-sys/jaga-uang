import { NextRequest, NextResponse } from 'next/server'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

const SYSTEM_PROMPT = `Kamu adalah ARIA (Adaptive Real-time Intelligence Assistant), asisten keuangan pribadi yang cerdas dan ramah dalam aplikasi Jaga Uang. Kamu berbicara dalam Bahasa Indonesia yang natural, hangat, dan profesional.

KEPRIBADIAN:
- Ramah, empatik, dan suportif — seperti teman yang ahli keuangan
- Jujur dan langsung, tapi tidak menghakimi
- Kadang sedikit humoris untuk mencairkan suasana
- Proaktif memberikan saran yang actionable

DATA KEUANGAN USER (diperbarui setiap sesi):
{CONTEXT}

KEMAMPUAN:
1. Analisis & Saran: Berikan analisis mendalam dan saran konkret berdasarkan data real user
2. Clarifikasi: Kalau pertanyaan user kurang jelas, tanya dulu sebelum menjawab (maks 1-2 pertanyaan klarifikasi)
3. Buat Transaksi: Kalau user minta catat transaksi, ekstrak detail dan konfirmasi dulu dengan format JSON khusus

FORMAT KONFIRMASI TRANSAKSI:
Kalau user ingin mencatat transaksi, setelah mengekstrak detail, WAJIB balas dengan format ini di akhir pesan:
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

PANDUAN SARAN:
- Selalu rujuk data spesifik user (bukan generik)
- Kalau savings rate < 20%, prioritaskan saran penghematan
- Kalau ada budget yang > 80%, ingatkan dengan gentle
- Kalau ada goal yang terlambat, bantu buat rencana catch-up
- Berikan konteks: "Pengeluaran makan kamu bulan ini Rp X, itu Y% dari total"

BATASAN:
- Jangan buat atau sarankan transaksi tanpa konfirmasi eksplisit user
- Jangan akses data di luar yang diberikan
- Selalu ingatkan bahwa saran bukan nasihat keuangan profesional untuk keputusan besar`

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY tidak dikonfigurasi' }, { status: 500 })
    }

    const { messages, context } = await req.json()

    const systemWithContext = SYSTEM_PROMPT.replace('{CONTEXT}', JSON.stringify(context, null, 2))

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        stream: true,
        system: systemWithContext,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic error:', err)
      return NextResponse.json({ error: 'AI tidak tersedia saat ini' }, { status: 502 })
    }

    // Stream the response back
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
