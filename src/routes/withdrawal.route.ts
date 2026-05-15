import { Hono } from "hono";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/rbac.middleware";
import {
  createWithdrawalSchema,
  getWithdrawalsQuerySchema,
} from "../validators/withdrawal.validator";
import {
  createWithdrawal,
  getMyWithdrawals,
  getWithdrawalById,
  getWithdrawalProof,
} from "../services/withdrawal.service";
import { successResponse, errorResponse } from "../utils/response";

export const withdrawalRoute = new Hono();

// -------------------------------------------------------
// GET /api/withdrawals
// -------------------------------------------------------
withdrawalRoute.get(
  "/",
  authenticate,
  requirePermission("withdrawal:view:own"),
  async (c) => {
    const { userId } = c.get("user");
    const query = getWithdrawalsQuerySchema.safeParse(c.req.query());

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

    const result = await getMyWithdrawals(
      userId,
      query.data.page,
      query.data.limit
    );

    return successResponse(c, result, "OK");
  }
);

// -------------------------------------------------------
// GET /api/withdrawals/:id
// -------------------------------------------------------
withdrawalRoute.get(
  "/:id",
  authenticate,
  requirePermission("withdrawal:view:own"),
  async (c) => {
    const { userId } = c.get("user");
    const withdrawal = await getWithdrawalById(c.req.param("id"), userId);

    return successResponse(c, { withdrawal }, "OK");
  }
);

// -------------------------------------------------------
// GET /api/withdrawals/:id/proof
// -------------------------------------------------------
withdrawalRoute.get(
  "/:id/proof",
  authenticate,
  requirePermission("withdrawal:view:own"),
  async (c) => {
    const { userId } = c.get("user");

    const proofUrl = await getWithdrawalProof(userId, c.req.param("id"));

    return successResponse(c, { proofUrl }, "OK");
  }
);

// -------------------------------------------------------
// POST /api/withdrawals
// -------------------------------------------------------
withdrawalRoute.post(
  "/",
  authenticate,
  requirePermission("withdrawal:request"),
  async (c) => {
    const { userId } = c.get("user");
    const body = await c.req.json();

    const result = createWithdrawalSchema.safeParse(body);
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

    const withdrawal = await createWithdrawal(userId, result.data);

    return successResponse(
      c,
      { withdrawal },
      "Permintaan penarikan berhasil diajukan",
      201
    );
  }
);
