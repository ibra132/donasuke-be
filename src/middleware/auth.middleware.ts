import { createMiddleware } from 'hono/factory'
import { verifyToken } from '../lib/jwt'
import { AppError } from '../utils/error'
import type { JwtPayload } from '../types/context'

declare module 'hono' {
  interface ContextVariableMap {
    user: JwtPayload
  }
}

export const authenticate = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, message: 'Token tidak ditemukan' }, 401)
  }

  const token = authHeader.split(' ')[1]

  try {
    const payload = verifyToken(token)
    c.set('user', payload)
    await next()
  } catch (error) {
    const message = error instanceof AppError ? error.message : 'Token tidak valid'
    return c.json({ success: false, message }, 401)
  }
})
