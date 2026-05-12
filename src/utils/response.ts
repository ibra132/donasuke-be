import type { Context } from 'hono'

export function successResponse(
  c: Context<any>,
  data: unknown,
  message: string,
  status: number = 200
) {
  return c.json({ success: true, message, data }, status as any)
}

export function errorResponse(
  c: Context<any>,
  message: string,
  status: number,
  errors?: Array<{ field: string; message: string }>
) {
  return c.json({ success: false, message, ...(errors && { errors }) }, status as any)
}
