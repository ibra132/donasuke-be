import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { createMiddleware } from "hono/factory";

declare module "hono" {
  interface ContextVariableMap {
    userId: string;
    userRole: string;
  }
}

// -------------------------------------------------------
// AUTHENTICATE
// Check if the user is authenticated by verifying the JWT token
// -------------------------------------------------------
export const authenticate = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ message: "Token tidak ditemukan!" }, 401);
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string;
      role: string;
    };

    // Set user info in context for later use
    c.set("userId", decoded.id);
    c.set("userRole", decoded.role);

    await next();
  } catch (error) {
    return c.json({ message: "Token tidak valid!" }, 401);
  }
});

// -------------------------------------------------------
// AUTHORIZE
// Check if the user has the required role(s) to access a route
// -------------------------------------------------------
export const authorize = (...roles: string[]) =>
  createMiddleware(async (c, next) => {
    const userRole = c.get("userRole");

    if (!roles.includes(userRole)) {
      return c.json({ message: "Akses ditolak" }, 403);
    }

    await next();
  });
