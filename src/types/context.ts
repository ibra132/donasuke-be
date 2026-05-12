export interface JwtPayload {
  userId: string
  roles: string[]
  permissions: string[]
}

export type HonoVariables = {
  user: JwtPayload
}
