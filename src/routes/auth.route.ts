import { Hono } from "hono";
import { authenticate } from "../middleware/auth.middleware";
import { registerSchema, loginSchema } from "../validators/auth.validator";
import { register, login, getMe } from "../services/auth.service";
import { successResponse, errorResponse } from "../utils/response";

export const authRoute = new Hono();

authRoute.get("/", (c) => c.json({ message: "auth route" }));

// ── Public

// -------------------------------------------------------
// POST /api/auth/register
// -------------------------------------------------------
authRoute.post("/register", async (c) => {
  const body = await c.req.json();
  const result = registerSchema.safeParse(body);

  if (!result.success) {
    return errorResponse(
      c,
      "Validasi gagal",
      400,
      result.error.issues.map((i) => ({
        field: String(i.path[0] ?? ""),
        message: i.message,
      }))
    );
  }

  const { user, token } = await register(result.data);

  return successResponse(c, { user, token }, "Registrasi berhasil", 201);
});

// -------------------------------------------------------
// POST /api/auth/login
// -------------------------------------------------------
authRoute.post("/login", async (c) => {
  const body = await c.req.json();
  const result = loginSchema.safeParse(body);

  if (!result.success) {
    return errorResponse(
      c,
      "Validasi gagal",
      400,
      result.error.issues.map((i) => ({
        field: String(i.path[0] ?? ""),
        message: i.message,
      }))
    );
  }

  const { user, token } = await login(result.data);

  return successResponse(c, { user, token }, "Login berhasil");
});

// -------------------------------------------------------
// GET /api/auth/me
// -------------------------------------------------------
authRoute.get("/me", authenticate, async (c) => {
  const { userId } = c.get("user");
  const user = await getMe(userId);

  return successResponse(c, { user }, "OK");
});
