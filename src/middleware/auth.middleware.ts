import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { createMiddleware } from "hono/factory";

declare module "hono" {
  interface ContextVariableMap {
    userId: string;
    userPermissions: string[];
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
    };

    // Fetch user permissions from the database
    const userRoles = await prisma.userRole.findMany({
      where: { userId: decoded.id },
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
    });

    // Flatten permissions into a single array of permission actions
    const permissions = userRoles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.action)
    );

    c.set("userId", decoded.id);
    c.set("userPermissions", permissions);

    await next();
  } catch (error) {
    return c.json({ message: "Token tidak valid!" }, 401);
  }
});

// -------------------------------------------------------
// AUTHORIZE
// Check if the user has the required role(s) to access a route
// -------------------------------------------------------
export const authorize = (...requiredPermissions: string[]) =>
  createMiddleware(async (c, next) => {
    const userPermissions = c.get("userPermissions");

    const hasPermission = requiredPermissions.every((p) =>
      userPermissions.includes(p)
    );

    if (!hasPermission) {
      return c.json({ message: "Akses ditolak" }, 403);
    }

    await next();
  });
