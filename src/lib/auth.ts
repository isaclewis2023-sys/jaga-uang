import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) throw new Error('JWT_SECRET environment variable is not set')
const SECRET = new TextEncoder().encode(jwtSecret)

const COOKIE_NAME = 'jaga-uang-token'
const EXPIRES_IN = '7d'

export interface JwtPayload {
  sub: string
  iat: number
  exp: number
}

export async function signToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(SECRET)
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as JwtPayload
  } catch {
    return null
  }
}

export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getAuthToken()
  if (!token) return false
  const payload = await verifyToken(token)
  return payload !== null
}

export const COOKIE_NAME_EXPORT = COOKIE_NAME
export { COOKIE_NAME }
