import { Hono } from "hono";
import { requirePermission } from "../../middleware/rbac.middleware";
import {
  getVerificationsQuerySchema,
  rejectVerificationSchema,
} from "../../validators/user.validator";
import {
  getVerifications,
  getVerificationDetail,
  approveVerification,
  rejectVerification,
} from "../../services/user.service";
import { successResponse, errorResponse } from "../../utils/response";

export const verificationRoute = new Hono();

// -------------------------------------------------------
// GET /api/admin/verifications?status=PENDING&page=1&limit=20
// -------------------------------------------------------
verificationRoute.get("/", async (c) => {
  const query = getVerificationsQuerySchema.safeParse(c.req.query());

  if (!query.success) {
    return errorResponse(
      c,
      "Query tidak valid",
      400,
      query.error.issues.map((i) => ({
        field: String(i.path[0] ?? ""),
        message: i.message,
      }))
    );
  }

  const { status, page, limit } = query.data;
  const result = await getVerifications(status, page, limit);

  return successResponse(c, result, "OK");
});

// -------------------------------------------------------
// GET /api/admin/verifications/:id
// -------------------------------------------------------
verificationRoute.get("/:id", async (c) => {
  const user = await getVerificationDetail(c.req.param("id"));
  return successResponse(c, { user }, "OK");
});

// -------------------------------------------------------
// POST /api/admin/verifications/:id/approve
// -------------------------------------------------------
verificationRoute.post(
  "/:id/approve",
  requirePermission("user:verify"),
  async (c) => {
    await approveVerification(c.req.param("id"));

    return successResponse(
      c,
      null,
      "Verifikasi disetujui. User sekarang dapat membuat campaign."
    );
  }
);

// -------------------------------------------------------
// POST /api/admin/verifications/:id/reject
// -------------------------------------------------------
verificationRoute.post(
  "/:id/reject",
  requirePermission("user:reject-verification"),
  async (c) => {
    const body = await c.req.json();
    const result = rejectVerificationSchema.safeParse(body);

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

    await rejectVerification(c.req.param("id"), result.data.reason);

    return successResponse(c, null, "Verifikasi berhasil ditolak");
  }
);
