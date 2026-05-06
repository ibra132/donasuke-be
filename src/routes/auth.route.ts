import { Hono } from "hono";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth.middleware";
import { registerSchema, loginSchema } from "../validators/auth.validator";

export const authRoute = new Hono();

authRoute.get("/", (c) => {
  return c.json({ message: "auth route" });
});

// -------------------------------------------------------
// REGISTER
// POST /api/auth/register
// -------------------------------------------------------
authRoute.post("/register", async (c) => {
  const body = await c.req.json();

  // Validate input
  const result = registerSchema.safeParse(body);
  if (!result.success) {
    return c.json(
      {
        message: "Validasi gagal",
        errors: result.error.flatten().fieldErrors,
      },
      400
    );
  }

  const { name, email, password } = result.data;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    return c.json({ message: "Email sudah terdaftar" }, 400);
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user and assign default role
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      roles: {
        create: {
          role: {
            connect: {
              name: "DONATUR",
            },
          },
        },
      },
    },
  });

  return c.json(
    {
      message: "Registrasi berhasil",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    },
    201
  );
});

// -------------------------------------------------------
// LOGIN
// POST /api/auth/login
// -------------------------------------------------------
authRoute.post("/login", async (c) => {
  const body = await c.req.json();

  // Validate input
  const result = loginSchema.safeParse(body);
  if (!result.success) {
    return c.json(
      {
        message: "Validasi gagal",
        errors: result.error.flatten().fieldErrors,
      },
      400
    );
  }

  const { email, password } = result.data;

  // Find user with roles and permissions
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    return c.json({ message: "Email atau password salah" }, 401);
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return c.json({ message: "Email atau password salah" }, 401);
  }

  // Flatten permissions
  const permissions = user.roles.flatMap((ur) =>
    ur.role.permissions.map((rp) => rp.permission.action)
  );

  // Take role names
  const roles = user.roles.map((ur) => ur.role.name);

  // Sign JWT
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET as string, {
    expiresIn: "7d",
  });

  return c.json({
    message: "Login berhasil",
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      roles,
      permissions,
    },
  });
});

// -------------------------------------------------------
// GET CURRENT USER
// GET /api/auth/me
// -------------------------------------------------------
authRoute.get("/me", authenticate, async (c) => {
  const userId = c.get("userId");

  const user = await prisma.user.findUnique({
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
              permissions: {
                select: {
                  permission: {
                    select: {
                      action: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    return c.json({ message: "User tidak ditemukan" }, 404);
  }

  // Flatten for clarity in response
  const roles = user.roles.map((ur) => ur.role.name);
  const permissions = user.roles.flatMap((ur) =>
    ur.role.permissions.map((rp) => rp.permission.action)
  );

  return c.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      bio: user.bio,
      verificationStatus: user.verificationStatus,
      createdAt: user.createdAt,
      roles,
      permissions,
    },
  });
});
