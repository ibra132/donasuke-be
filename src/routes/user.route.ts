import { Hono } from "hono";
import { authenticate } from "../middleware/auth.middleware";
import {
  updateProfileSchema,
  verificationSchema,
} from "../validators/user.validator";
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  submitVerification,
} from "../services/user.service";
import { successResponse, errorResponse } from "../utils/response";

export const userRoute = new Hono();

// -------------------------------------------------------
// GET /api/users/me
// -------------------------------------------------------
userRoute.get("/me", authenticate, async (c) => {
  const { userId } = c.get("user");
  const user = await getProfile(userId);

  return successResponse(c, { user }, "OK");
});

// -------------------------------------------------------
// PATCH /api/users/me
// -------------------------------------------------------
userRoute.patch("/me", authenticate, async (c) => {
  const { userId } = c.get("user");
  const body = await c.req.json();

  const result = updateProfileSchema.safeParse(body);
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

  const user = await updateProfile(userId, result.data);

  return successResponse(c, { user }, "Profil berhasil diperbarui");
});

// -------------------------------------------------------
// POST /api/users/me/avatar
// -------------------------------------------------------
userRoute.post("/me/avatar", authenticate, async (c) => {
  const { userId } = c.get("user");
  const body = await c.req.parseBody();
  const file = body["avatar"];

  if (!(file instanceof File)) {
    return errorResponse(c, "File avatar diperlukan", 400);
  }

  const avatarUrl = await uploadAvatar(userId, file);

  return successResponse(c, { avatarUrl }, "Avatar berhasil diperbarui");
});

// -------------------------------------------------------
// POST /api/users/me/verification
// -------------------------------------------------------
userRoute.post("/me/verification", authenticate, async (c) => {
  const { userId } = c.get("user");
  const body = await c.req.parseBody();

  const result = verificationSchema.safeParse({ nik: body["nik"] });
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

  const ktpFile = body["ktpFile"];
  if (!(ktpFile instanceof File)) {
    return errorResponse(c, "File KTP diperlukan", 400);
  }

  const data = await submitVerification(userId, result.data.nik, ktpFile);

  return successResponse(
    c,
    data,
    "Verifikasi berhasil disubmit, menunggu review admin"
  );
});
