import { Hono } from "hono";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/rbac.middleware";
import {
  createDonationSchema,
  getDonationsQuerySchema,
} from "../validators/donation.validator";
import {
  createDonation,
  getMyDonations,
  getDonationById,
} from "../services/donation.service";
import { successResponse, errorResponse } from "../utils/response";

export const donationRoute = new Hono();

// -------------------------------------------------------
// GET /api/donations
// -------------------------------------------------------
donationRoute.get(
  "/",
  authenticate,
  requirePermission("donation:view:own"),
  async (c) => {
    const { userId } = c.get("user");
    const query = getDonationsQuerySchema.safeParse(c.req.query());

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

    const result = await getMyDonations(
      userId,
      query.data.page,
      query.data.limit
    );

    return successResponse(c, result, "OK");
  }
);

// -------------------------------------------------------
// GET /api/donations/:id
// -------------------------------------------------------
donationRoute.get("/:id", authenticate, async (c) => {
  const { userId } = c.get("user");
  const donation = await getDonationById(c.req.param("id"), userId);

  return successResponse(c, { donation }, "OK");
});

// -------------------------------------------------------
// POST /api/donations
// -------------------------------------------------------
donationRoute.post(
  "/",
  authenticate,
  requirePermission("donation:create"),
  async (c) => {
    const { userId } = c.get("user");
    const body = await c.req.json();

    const result = createDonationSchema.safeParse(body);
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

    const donation = await createDonation(userId, result.data);

    return successResponse(c, { donation }, "Donasi berhasil dibuat", 201);
  }
);
