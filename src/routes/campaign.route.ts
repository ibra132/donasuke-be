import { Hono } from "hono";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/rbac.middleware";
import {
  createCampaignSchema,
  updateCampaignSchema,
  addCampaignUpdateSchema,
  getCampaignsQuerySchema,
} from "../validators/campaign.validator";
import {
  addCampaignDocument,
  getCampaignDocuments,
  updateCampaignDocument,
  deleteCampaignDocument,
  createCampaign,
  getCampaigns,
  getCampaignById,
  updateCampaign,
  submitCampaign,
  deleteCampaign,
  addCampaignUpdate,
  toggleSaveCampaign,
  getSavedCampaigns,
  getCampaignUpdates,
  editCampaignUpdate,
  deleteCampaignUpdate,
} from "../services/campaign.service";
import { successResponse, errorResponse } from "../utils/response";

export const campaignRoute = new Hono();

// ── Public

// -------------------------------------------------------
// GET /api/campaigns
// -------------------------------------------------------
campaignRoute.get("/", async (c) => {
  const query = getCampaignsQuerySchema.safeParse(c.req.query());
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

  const result = await getCampaigns(query.data);

  return successResponse(c, result, "OK");
});

// -------------------------------------------------------
// GET /api/campaigns/saved
// -------------------------------------------------------
campaignRoute.get("/saved", authenticate, async (c) => {
  const { userId } = c.get("user");

  const campaigns = await getSavedCampaigns(userId);

  return successResponse(c, { campaigns }, "OK");
});

// -------------------------------------------------------
// GET /api/campaigns/:id
// -------------------------------------------------------
campaignRoute.get("/:id", async (c) => {
  const campaign = await getCampaignById(c.req.param("id"));

  return successResponse(c, { campaign }, "OK");
});

// -------------------------------------------------------
// GET /api/campaigns/:id/updates
// -------------------------------------------------------
campaignRoute.get("/:id/updates", async (c) => {
  const updates = await getCampaignUpdates(c.req.param("id"));

  return successResponse(c, { updates }, "OK");
});

// ── Protected

// -------------------------------------------------------
// POST /api/campaigns
// -------------------------------------------------------
campaignRoute.post(
  "/",
  authenticate,
  requirePermission("campaign:create"),
  async (c) => {
    const { userId } = c.get("user");
    const body = await c.req.parseBody();

    const jsonFields = {
      title: body["title"],
      category: body["category"],
      description: body["description"],
      targetAmount: Number(body["targetAmount"]),
      deadline: body["deadline"],
      location: body["location"] || undefined,
    };

    const result = createCampaignSchema.safeParse(jsonFields);
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
    const imageFile = body["image"] instanceof File ? body["image"] : undefined;

    const campaign = await createCampaign(userId, result.data, imageFile);

    return successResponse(c, { campaign }, "Campaign berhasil dibuat", 201);
  }
);

// -------------------------------------------------------
// PATCH /api/campaigns/:id
// -------------------------------------------------------
campaignRoute.patch(
  "/:id",
  authenticate,
  requirePermission("campaign:update:own"),
  async (c) => {
    const { userId } = c.get("user");
    const body = await c.req.parseBody();

    const jsonFields = {
      ...(body["title"] && { title: body["title"] }),
      ...(body["description"] && { description: body["description"] }),
      ...(body["targetAmount"] && {
        targetAmount: Number(body["targetAmount"]),
      }),
      ...(body["deadline"] && { deadline: body["deadline"] }),
      ...(body["location"] && { location: body["location"] }),
    };

    const result = updateCampaignSchema.safeParse(jsonFields);
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
    const imageFile = body["image"] instanceof File ? body["image"] : undefined;

    const campaign = await updateCampaign(
      c.req.param("id"),
      userId,
      result.data,
      imageFile
    );

    return successResponse(c, { campaign }, "Campaign berhasil diperbarui");
  }
);

// -------------------------------------------------------
// DELETE /api/campaigns/:id
// -------------------------------------------------------
campaignRoute.delete(
  "/:id",
  authenticate,
  requirePermission("campaign:update:own"),
  async (c) => {
    const { userId } = c.get("user");
    await deleteCampaign(c.req.param("id"), userId);

    return successResponse(c, null, "Campaign berhasil dihapus");
  }
);

// -------------------------------------------------------
// POST /api/campaigns/:id/submit
// -------------------------------------------------------
campaignRoute.post(
  "/:id/submit",
  authenticate,
  requirePermission("campaign:submit"),
  async (c) => {
    const { userId } = c.get("user");
    const campaign = await submitCampaign(c.req.param("id"), userId);

    return successResponse(
      c,
      { campaign },
      "Campaign berhasil disubmit untuk review"
    );
  }
);

// -------------------------------------------------------
// POST /api/campaigns/:id/updates
// -------------------------------------------------------
campaignRoute.post(
  "/:id/updates",
  authenticate,
  requirePermission("campaign:update:own"),
  async (c) => {
    const { userId } = c.get("user");
    const body = await c.req.json();

    const result = addCampaignUpdateSchema.safeParse(body);
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

    const update = await addCampaignUpdate(
      c.req.param("id"),
      userId,
      result.data.content
    );

    return successResponse(c, { update }, "Update berhasil ditambahkan", 201);
  }
);

// -------------------------------------------------------
// PATCH /campaigns/:id/updates/:updateId
// -------------------------------------------------------
campaignRoute.patch(
  "/:id/updates/:updateId",
  authenticate,
  requirePermission("campaign:update:own"),
  async (c) => {
    const { userId } = c.get("user");
    const body = await c.req.json();

    const result = addCampaignUpdateSchema.safeParse(body);
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

    const update = await editCampaignUpdate(
      userId,
      c.req.param("id"),
      c.req.param("updateId"),
      result.data.content
    );

    return successResponse(c, { update }, "Update berhasil diperbarui");
  }
);

// -------------------------------------------------------
// DELETE /api/campaigns/:id/updates/:updateId
// -------------------------------------------------------
campaignRoute.delete(
  "/:id/updates/:updateId",
  authenticate,
  requirePermission("campaign:update:own"),
  async (c) => {
    const { userId } = c.get("user");
    await deleteCampaignUpdate(
      userId,
      c.req.param("id"),
      c.req.param("updateId")
    );

    return successResponse(c, null, "Update berhasil dihapus");
  }
);

// -------------------------------------------------------
// GET /api/campaigns/:id/documents
// -------------------------------------------------------
campaignRoute.get(
  "/:id/documents",
  authenticate,
  requirePermission("campaign:update:own"),
  async (c) => {
    const { userId } = c.get("user");
    const docs = await getCampaignDocuments(c.req.param("id"), userId);

    return successResponse(c, { documents: docs }, "OK");
  }
);

// -------------------------------------------------------
// POST /api/campaigns/:id/documents
// -------------------------------------------------------
campaignRoute.post(
  "/:id/documents",
  authenticate,
  requirePermission("campaign:update:own"),
  async (c) => {
    const { userId } = c.get("user");
    const body = await c.req.parseBody();

    const docFile = body["document"];
    const documentType = body["documentType"];
    if (!(docFile instanceof File)) {
      return errorResponse(c, "File dokumen diperlukan", 400);
    }
    if (!documentType || typeof documentType !== "string") {
      return errorResponse(c, "documentType diperlukan", 400);
    }

    const doc = await addCampaignDocument(
      c.req.param("id"),
      userId,
      docFile,
      documentType
    );

    return successResponse(
      c,
      { document: doc },
      "Dokumen berhasil diupload",
      201
    );
  }
);

// -------------------------------------------------------
// PATCH /api/campaigns/documents/:docId
// -------------------------------------------------------
campaignRoute.patch(
  "/documents/:docId",
  authenticate,
  requirePermission("campaign:update:own"),
  async (c) => {
    const { userId } = c.get("user");
    const body = await c.req.parseBody();
    const newFile = body["document"];
    const documentType =
      typeof body["documentType"] === "string"
        ? body["documentType"]
        : undefined;

    if (!(newFile instanceof File)) {
      return errorResponse(c, "File dokumen diperlukan", 400);
    }

    const doc = await updateCampaignDocument(
      c.req.param("docId"),
      userId,
      newFile,
      documentType
    );

    return successResponse(c, { document: doc }, "Dokumen berhasil diperbarui");
  }
);

// -------------------------------------------------------
// DELETE /api/campaigns/documents/:docId
// -------------------------------------------------------
campaignRoute.delete(
  "/documents/:docId",
  authenticate,
  requirePermission("campaign:update:own"),
  async (c) => {
    const { userId } = c.get("user");
    await deleteCampaignDocument(c.req.param("docId"), userId);

    return successResponse(c, null, "Dokumen berhasil dihapus");
  }
);

// -------------------------------------------------------
// POST /api/campaigns/:id/save
// -------------------------------------------------------
campaignRoute.post(
  "/:id/save",
  authenticate,
  requirePermission("saved-campaign:create"),
  async (c) => {
    const { userId } = c.get("user");
    const result = await toggleSaveCampaign(userId, c.req.param("id"));
    const msg = result.saved
      ? "Campaign disimpan"
      : "Campaign dihapus dari simpanan";

    return successResponse(c, result, msg);
  }
);
