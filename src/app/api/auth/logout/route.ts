import { NextResponse } from 'next/server'

const COOKIE_NAME = 'jaga-uang-token'

export async function POST() {
  const res = NextResponse.json({ success: true })
  res.cookies.delete(COOKIE_NAME)
  return res
}
