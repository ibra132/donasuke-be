import { Hono } from "hono";
import { requirePermission } from "../../middleware/rbac.middleware";
import {
  rejectWithdrawalSchema,
  getWithdrawalsQuerySchema,
} from "../../validators/withdrawal.validator";
import {
  getAllWithdrawals,
  getWithdrawalByIdAdmin,
  approveWithdrawal,
  rejectWithdrawal,
  markWithdrawalPaid,
} from "../../services/withdrawal.service";
import { successResponse, errorResponse } from "../../utils/response";

export const adminWithdrawalRoute = new Hono();

// -------------------------------------------------------
// GET /api/admin/withdrawals
// -------------------------------------------------------
adminWithdrawalRoute.get(
  "/",
  requirePermission("withdrawal:view:all"),
  async (c) => {
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

    const result = await getAllWithdrawals(
      query.data.page,
      query.data.limit,
      query.data.status
    );

    return successResponse(c, result, "OK");
  }
);

// -------------------------------------------------------
// GET /api/admin/withdrawals/:id
// -------------------------------------------------------
adminWithdrawalRoute.get(
  "/:id",
  requirePermission("withdrawal:view:all"),
  async (c) => {
    const withdrawal = await getWithdrawalByIdAdmin(c.req.param("id"));

    return successResponse(c, { withdrawal }, "OK");
  }
);

// -------------------------------------------------------
// POST /api/admin/withdrawals/:id/approve
// -------------------------------------------------------
adminWithdrawalRoute.post(
  "/:id/approve",
  requirePermission("withdrawal:approve"),
  async (c) => {
    const withdrawal = await approveWithdrawal(c.req.param("id"));

    return successResponse(c, { withdrawal }, "Penarikan berhasil di-approve");
  }
);

// -------------------------------------------------------
// POST /api/admin/withdrawals/:id/reject
// -------------------------------------------------------
adminWithdrawalRoute.post(
  "/:id/reject",
  requirePermission("withdrawal:reject"),
  async (c) => {
    const body = await c.req.json();
    const result = rejectWithdrawalSchema.safeParse(body);

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

    const withdrawal = await rejectWithdrawal(
      c.req.param("id"),
      result.data.note
    );

    return successResponse(c, { withdrawal }, "Penarikan berhasil di-reject");
  }
);

// -------------------------------------------------------
// POST /api/admin/withdrawals/:id/pay
// -------------------------------------------------------
adminWithdrawalRoute.post(
  "/:id/pay",
  requirePermission("withdrawal:approve"),
  async (c) => {
    const body = await c.req.parseBody();
    const proofFile = body["proof"];

    if (!(proofFile instanceof File)) {
      return errorResponse(c, "File bukti transfer diperlukan", 400);
    }

    const withdrawal = await markWithdrawalPaid(c.req.param("id"), proofFile);

    return successResponse(
      c,
      { withdrawal },
      "Penarikan berhasil ditandai PAID"
    );
  }
);
