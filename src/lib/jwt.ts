import jwt from 'jsonwebtoken'
import { AppError } from '../utils/error'
import { JWT_EXPIRES_IN } from '../utils/constants'
import type { JwtPayload } from '../types/context'

const JWT_SECRET = process.env.JWT_SECRET as string

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions)
}

export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload
  } catch {
    throw new AppError(401, 'Token tidak valid')
  }
}
