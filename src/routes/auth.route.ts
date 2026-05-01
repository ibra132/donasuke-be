import { Hono } from "hono";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth.middleware";

export const authRoute = new Hono();

authRoute.get("/", (c) => {
  return c.json({ message: "auth route" });
});

// -------------------------------------------------------
// REGISTER
// POST /api/auth/register
// -------------------------------------------------------
authRoute.post("/register", async (c) => {
  const { name, email, password } = await c.req.json();

  // Validate input
  if (!name || !email || !password) {
    return c.json({ message: "Semua field wajib diisi!" }, 400);
  }

  // Check if email already exists
  if (email) {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return c.json({ message: "Email sudah terdaftar!" }, 400);
    }
  }

  // Hash password before saving to database
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create new user
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
    },
  });

  return c.json(
    {
      message: "Registrasi berhasil",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
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
  const { email, password } = await c.req.json();

  // Validate input
  if (!email || !password) {
    return c.json({ message: "Email dan password wajib diisi!" }, 400);
  }

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return c.json({ message: "Email tidak ditemukan!" }, 404);
  }

  // Compare password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return c.json({ message: "Password salah!" }, 401);
  }

  // Generate JWT token
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET as string,
    { expiresIn: "7d" }
  );

  return c.json({
    message: "Login berhasil",
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
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
      role: true,
      avatar: true,
      bio: true,
      verificationStatus: true,
      createdAt: true,
    },
  });

  if (!user) {
    return c.json({ message: "User tidak ditemukan!" }, 404);
  }

  return c.json(user);
});
