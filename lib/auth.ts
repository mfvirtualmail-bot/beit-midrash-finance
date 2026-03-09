import crypto from 'crypto'
export { COOKIE_NAME, COOKIE_MAX_AGE } from './constants'

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':')
  if (parts.length !== 2) return false
  const [salt, hash] = parts
  const hashVerify = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(hashVerify, 'hex'))
  } catch {
    return false
  }
}

export function createSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}
