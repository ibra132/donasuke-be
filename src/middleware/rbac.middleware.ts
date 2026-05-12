import { createMiddleware } from 'hono/factory'
import { AppError } from '../utils/error'

export const requirePermission = (...permissions: string[]) =>
  createMiddleware(async (c, next) => {
    const user = c.get('user')
    const hasAll = permissions.every((p) => user.permissions.includes(p))
    if (!hasAll) throw new AppError(403, 'Akses ditolak')
    await next()
  })

export const requireRole = (...roles: string[]) =>
  createMiddleware(async (c, next) => {
    const user = c.get('user')
    const hasRole = roles.some((r) => user.roles.includes(r))
    if (!hasRole) throw new AppError(403, 'Akses ditolak')
    await next()
  })
