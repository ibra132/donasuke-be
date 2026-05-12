import prisma from '../lib/prisma'
import { hashPassword, comparePassword } from '../lib/bcrypt'
import { signToken } from '../lib/jwt'
import { AppError } from '../utils/error'

type RegisterInput = { name: string; email: string; password: string }
type LoginInput = { email: string; password: string }

async function getUserWithRoles(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      bio: true,
      verificationStatus: true,
      createdAt: true,
      roles: {
        select: {
          role: {
            select: {
              name: true,
              permissions: { select: { permission: { select: { action: true } } } },
            },
          },
        },
      },
    },
  })
}

function flattenRolesPermissions(user: NonNullable<Awaited<ReturnType<typeof getUserWithRoles>>>) {
  const roles = user.roles.map((ur) => ur.role.name)
  const permissions = user.roles.flatMap((ur) =>
    ur.role.permissions.map((rp) => rp.permission.action)
  )
  return { roles, permissions }
}

export async function register(data: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } })
  if (existing) throw new AppError(409, 'Email sudah terdaftar')

  const hashed = await hashPassword(data.password)

  const created = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashed,
      roles: {
        create: { role: { connect: { name: 'DONATUR' } } },
      },
    },
    select: { id: true, name: true, email: true },
  })

  const full = await getUserWithRoles(created.id)
  if (!full) throw new AppError(500, 'Gagal mengambil data user')

  const { roles, permissions } = flattenRolesPermissions(full)
  const token = signToken({ userId: full.id, roles, permissions })

  return { user: { ...full, roles, permissions }, token }
}

export async function login(data: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: data.email },
    select: {
      id: true,
      name: true,
      email: true,
      password: true,
      avatar: true,
      bio: true,
      verificationStatus: true,
      createdAt: true,
      roles: {
        select: {
          role: {
            select: {
              name: true,
              permissions: { select: { permission: { select: { action: true } } } },
            },
          },
        },
      },
    },
  })

  if (!user || !(await comparePassword(data.password, user.password))) {
    throw new AppError(401, 'Email atau password salah')
  }

  const { roles, permissions } = flattenRolesPermissions(user)
  const token = signToken({ userId: user.id, roles, permissions })

  const { password: _, ...safeUser } = user
  return { user: { ...safeUser, roles, permissions }, token }
}

export async function getMe(userId: string) {
  const user = await getUserWithRoles(userId)
  if (!user) throw new AppError(404, 'User tidak ditemukan')

  const { roles, permissions } = flattenRolesPermissions(user)
  return { ...user, roles, permissions }
}
