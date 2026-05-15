import prisma from "../lib/prisma";
import {
  uploadFile,
  deleteFile,
  BUCKETS,
  getSignedUrl,
} from "./storage.service";
import { AppError } from "../utils/error";

type CreateCampaignInput = {
  title: string;
  category: string;
  description: string;
  targetAmount: number;
  deadline: Date;
  location?: string;
};

type UpdateCampaignInput = Partial<Omit<CreateCampaignInput, "category">>;

type GetCampaignsFilter = {
  category?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
};

type GetSavedCampaignsFilter = {
  page?: number;
  limit?: number;
};

const campaignPublicSelect = {
  id: true,
  title: true,
  category: true,
  description: true,
  targetAmount: true,
  collectedAmount: true,
  imageUrl: true,
  status: true,
  deadline: true,
  location: true,
  createdAt: true,
};

export async function createCampaign(
  userId: string,
  data: CreateCampaignInput,
  imageFile?: File
) {
  let imageUrl: string | undefined;

  if (imageFile) {
    const allowed = ["image/jpeg", "image/png", "image/webp"];

    if (!allowed.includes(imageFile.type))
      throw new AppError(400, "Format gambar tidak valid");

    if (imageFile.size > 5 * 1024 * 1024)
      throw new AppError(400, "Ukuran gambar maksimal 5MB");

    const ext = imageFile.type.split("/")[1];
    const path = `${userId}/${Date.now()}.${ext}`;
    imageUrl = await uploadFile(
      BUCKETS.CAMPAIGN_IMAGES,
      path,
      await imageFile.arrayBuffer(),
      imageFile.type
    );
  }

  return prisma.campaign.create({
    data: { ...data, userId, imageUrl },
    select: {
      ...campaignPublicSelect,
      user: { select: { name: true } },
    },
  });
}

export async function getCampaigns(
  filter: GetCampaignsFilter = {},
  userId?: string,
  withPendingTotal?: boolean
) {
  console.log(filter, userId, withPendingTotal);
  const { category, status = "ACTIVE", search, page = 1, limit = 12 } = filter;
  const skip = (page - 1) * limit;

  const where = {
    ...(userId && { userId }),
    ...(status && { status: status as any }),
    ...(category && { category }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" as const } },
        { description: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [data, total, totalPending] = await prisma.$transaction([
    prisma.campaign.findMany({
      where,
      select: {
        ...campaignPublicSelect,
        ...(userId && { availableBalance: true }),
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.campaign.count({ where }),
    prisma.campaign.count({
      where: {
        status: "PENDING_REVIEW",
      },
    }),
  ]);

  return {
    data,
    total,
    page,
    limit,
    ...(withPendingTotal && { totalPending }),
  };
}

export async function getCampaignById(id: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: {
      ...campaignPublicSelect,
      rejectReason: true,
      user: { select: { id: true, name: true, avatar: true } },
      updates: {
        select: { id: true, content: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { donations: { where: { status: "SUCCESS" } } } },
    },
  });

  if (!campaign) throw new AppError(404, "Campaign tidak ditemukan");

  return campaign;
}

export async function updateCampaign(
  campaignId: string,
  userId: string,
  data: UpdateCampaignInput,
  imageFile?: File
) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) throw new AppError(404, "Campaign tidak ditemukan");

  if (campaign.userId !== userId)
    throw new AppError(403, "Bukan campaign milik Anda");

  if (campaign.status !== "DRAFT")
    throw new AppError(422, "Campaign tidak bisa diedit setelah disubmit");

  let imageUrl = campaign.imageUrl ?? undefined;

  if (imageFile) {
    const allowed = ["image/jpeg", "image/png", "image/webp"];

    if (!allowed.includes(imageFile.type))
      throw new AppError(400, "Format gambar tidak valid");

    if (imageFile.size > 5 * 1024 * 1024)
      throw new AppError(400, "Ukuran gambar maksimal 5MB");

    if (campaign.imageUrl) {
      const oldPath = campaign.imageUrl.split(`/campaign-images/`)[1];
      if (oldPath)
        await deleteFile(BUCKETS.CAMPAIGN_IMAGES, oldPath).catch(() => null);
    }

    const ext = imageFile.type.split("/")[1];
    const path = `${userId}/${Date.now()}.${ext}`;
    imageUrl = await uploadFile(
      BUCKETS.CAMPAIGN_IMAGES,
      path,
      await imageFile.arrayBuffer(),
      imageFile.type
    );
  }

  return prisma.campaign.update({
    where: { id: campaignId },
    data: { ...data, imageUrl },
    select: { ...campaignPublicSelect, user: { select: { name: true } } },
  });
}

export async function submitCampaign(campaignId: string, userId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) throw new AppError(404, "Campaign tidak ditemukan");

  if (campaign.userId !== userId)
    throw new AppError(403, "Bukan campaign milik Anda");

  if (campaign.status !== "DRAFT")
    throw new AppError(
      422,
      "Hanya campaign berstatus DRAFT yang bisa disubmit"
    );

  return prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "PENDING_REVIEW" },
    select: { ...campaignPublicSelect, user: { select: { name: true } } },
  });
}

export async function deleteCampaign(campaignId: string, userId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) throw new AppError(404, "Campaign tidak ditemukan");

  if (campaign.userId !== userId)
    throw new AppError(403, "Bukan campaign milik Anda");

  if (!["DRAFT", "REJECTED"].includes(campaign.status)) {
    throw new AppError(422, "Campaign aktif tidak bisa dihapus");
  }

  if (campaign.imageUrl) {
    const path = campaign.imageUrl.split(`/campaign-images/`)[1];
    if (path) await deleteFile(BUCKETS.CAMPAIGN_IMAGES, path).catch(() => null);
  }

  await prisma.campaign.delete({ where: { id: campaignId } });
}

export async function addCampaignDocument(
  campaignId: string,
  userId: string,
  docFile: File,
  documentType: string
) {
  const ALLOWED_DOC_TYPES = [
    "image/jpeg",
    "image/png",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const MAX_DOC_SIZE = 10 * 1024 * 1024; // 10MB

  if (!ALLOWED_DOC_TYPES.includes(docFile.type)) {
    throw new AppError(
      400,
      "Format dokumen tidak valid. Gunakan PDF, DOC, DOCX, JPG, atau PNG"
    );
  }
  if (docFile.size > MAX_DOC_SIZE) {
    throw new AppError(400, "Ukuran dokumen maksimal 10MB");
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) throw new AppError(404, "Campaign tidak ditemukan");

  if (campaign.userId !== userId)
    throw new AppError(403, "Bukan campaign milik Anda");

  if (campaign.status !== "DRAFT") {
    throw new AppError(
      422,
      "Dokumen hanya bisa ditambahkan saat campaign masih DRAFT"
    );
  }

  const ext = docFile.name.split(".").pop() ?? "bin";
  const path = `${campaignId}/${Date.now()}-${documentType}.${ext}`;
  const filePath = await uploadFile(
    BUCKETS.CAMPAIGN_DOCS,
    path,
    await docFile.arrayBuffer(),
    docFile.type
  );

  return prisma.campaignDocument.create({
    data: { campaignId, documentType, fileUrl: filePath },
    select: { id: true, documentType: true, createdAt: true },
  });
}

export async function getCampaignDocuments(campaignId: string, userId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { userId: true },
  });
  if (!campaign) throw new AppError(404, "Campaign tidak ditemukan");

  if (campaign.userId !== userId)
    throw new AppError(403, "Bukan campaign milik Anda");

  return prisma.campaignDocument.findMany({
    where: { campaignId },
    select: { id: true, documentType: true, fileUrl: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getCampaignDocumentUrl(
  documentId: string,
  userId: string
) {
  const document = await prisma.campaignDocument.findUnique({
    where: { id: documentId },
    select: { fileUrl: true, campaign: { select: { userId: true } } },
  });

  console.log(document);

  if (!document) throw new AppError(404, "Dokumen tidak ditemukan");

  if (document.campaign.userId !== userId)
    throw new AppError(403, "Anda tidak memiliki akses ke dokumen ini");

  if (!document.fileUrl) throw new AppError(404, "File belum tersedia");

  return getSignedUrl(BUCKETS.CAMPAIGN_DOCS, document.fileUrl, 60 * 60);
}

export async function getCampaignDocumentsAsAdmin(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  });
  if (!campaign) throw new AppError(404, "Campaign tidak ditemukan");

  return prisma.campaignDocument.findMany({
    where: { campaignId },
    select: { id: true, documentType: true, fileUrl: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getCampaignDocumentUrlAsAdmin(documentId: string) {
  const document = await prisma.campaignDocument.findUnique({
    where: { id: documentId },
    select: { fileUrl: true },
  });

  if (!document) throw new AppError(404, "Dokumen tidak ditemukan");
  if (!document.fileUrl) throw new AppError(404, "File belum tersedia");

  return getSignedUrl(BUCKETS.CAMPAIGN_DOCS, document.fileUrl, 60 * 60);
}

export async function updateCampaignDocument(
  docId: string,
  userId: string,
  newFile: File,
  documentType?: string
) {
  const ALLOWED_DOC_TYPES = [
    "image/jpeg",
    "image/png",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const MAX_DOC_SIZE = 10 * 1024 * 1024;

  if (!ALLOWED_DOC_TYPES.includes(newFile.type)) {
    throw new AppError(
      400,
      "Format dokumen tidak valid. Gunakan PDF, DOC, DOCX, JPG, atau PNG"
    );
  }

  if (newFile.size > MAX_DOC_SIZE)
    throw new AppError(400, "Ukuran dokumen maksimal 10MB");

  const doc = await prisma.campaignDocument.findUnique({
    where: { id: docId },
    include: { campaign: { select: { userId: true, status: true, id: true } } },
  });

  if (!doc) throw new AppError(404, "Dokumen tidak ditemukan");

  if (doc.campaign.userId !== userId)
    throw new AppError(403, "Bukan campaign milik Anda");

  if (doc.campaign.status !== "DRAFT") {
    throw new AppError(
      422,
      "Dokumen hanya bisa diubah saat campaign berstatus DRAFT"
    );
  }

  await deleteFile(BUCKETS.CAMPAIGN_DOCS, doc.fileUrl).catch(() => null);

  const type = documentType ?? doc.documentType;
  const ext = newFile.name.split(".").pop() ?? "bin";
  const path = `${doc.campaign.id}/${Date.now()}-${type}.${ext}`;
  const filePath = await uploadFile(
    BUCKETS.CAMPAIGN_DOCS,
    path,
    await newFile.arrayBuffer(),
    newFile.type
  );

  return prisma.campaignDocument.update({
    where: { id: docId },
    data: { fileUrl: filePath, documentType: type },
    select: { id: true, documentType: true, createdAt: true },
  });
}

export async function deleteCampaignDocument(docId: string, userId: string) {
  const doc = await prisma.campaignDocument.findUnique({
    where: { id: docId },
    include: { campaign: { select: { userId: true, status: true } } },
  });

  if (!doc) throw new AppError(404, "Dokumen tidak ditemukan");

  if (doc.campaign.userId !== userId)
    throw new AppError(403, "Bukan campaign milik Anda");

  if (doc.campaign.status !== "DRAFT") {
    throw new AppError(
      422,
      "Dokumen hanya bisa dihapus saat campaign berstatus DRAFT"
    );
  }

  await deleteFile(BUCKETS.CAMPAIGN_DOCS, doc.fileUrl).catch(() => null);
  await prisma.campaignDocument.delete({ where: { id: docId } });
}

export async function getCampaignUpdates(campaignId: string) {
  const updates = await prisma.campaignUpdate.findMany({
    where: { campaignId },
    select: { id: true, content: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  if (!updates) throw new AppError(404, "Campaign tidak ditemukan");

  return updates;
}

export async function addCampaignUpdate(
  campaignId: string,
  userId: string,
  content: string
) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) throw new AppError(404, "Campaign tidak ditemukan");

  if (campaign.userId !== userId)
    throw new AppError(403, "Bukan campaign milik Anda");

  if (campaign.status !== "ACTIVE")
    throw new AppError(422, "Hanya campaign aktif yang bisa diupdate");

  return prisma.campaignUpdate.create({
    data: { campaignId, content },
    select: { id: true, content: true, createdAt: true },
  });
}

export async function editCampaignUpdate(
  userId: string,
  campaignId: string,
  updateId: string,
  content: string
) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) throw new AppError(404, "Campaign tidak ditemukan");

  if (campaign.userId !== userId)
    throw new AppError(403, "Bukan campaign milik Anda");

  const update = await prisma.campaignUpdate.findUnique({
    where: { id: updateId, campaignId: campaignId },
  });

  if (!update) throw new AppError(404, "Update tidak ditemukan");

  return prisma.campaignUpdate.update({
    where: { id: updateId },
    data: { content },
    select: { id: true, content: true, createdAt: true },
  });
}

export async function deleteCampaignUpdate(
  userId: string,
  campaignId: string,
  updateId: string
) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) throw new AppError(404, "Campaign tidak ditemukan");

  if (campaign.userId !== userId)
    throw new AppError(403, "Bukan campaign milik Anda");

  const update = await prisma.campaignUpdate.findUnique({
    where: { id: updateId, campaignId: campaignId },
  });

  if (!update) throw new AppError(404, "Update tidak ditemukan");

  return prisma.campaignUpdate.delete({ where: { id: updateId } });
}

export async function toggleSaveCampaign(userId: string, campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) throw new AppError(404, "Campaign tidak ditemukan");

  const existing = await prisma.savedCampaign.findUnique({
    where: { userId_campaignId: { userId, campaignId } },
  });

  if (existing) {
    await prisma.savedCampaign.delete({
      where: { userId_campaignId: { userId, campaignId } },
    });

    return { saved: false };
  }

  await prisma.savedCampaign.create({ data: { userId, campaignId } });

  return { saved: true };
}

export async function getSavedCampaigns(
  userId: string,
  filter: GetSavedCampaignsFilter
) {
  const { page = 1, limit = 12 } = filter;
  const skip = (page - 1) * limit;

  const [data, total] = await prisma.$transaction([
    prisma.savedCampaign.findMany({
      where: { userId },
      select: {
        campaign: {
          select: {
            ...campaignPublicSelect,
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.savedCampaign.count({ where: { userId } }),
  ]);

  return { data: data.map((d) => d.campaign), total, page, limit };
}

export async function approveCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) throw new AppError(404, "Campaign tidak ditemukan");

  if (campaign.status !== "PENDING_REVIEW") {
    throw new AppError(
      422,
      "Hanya campaign berstatus PENDING_REVIEW yang bisa di-approve"
    );
  }

  return prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "ACTIVE" },
    select: {
      ...campaignPublicSelect,
      user: { select: { name: true, verificationStatus: true } },
    },
  });
}

export async function rejectCampaign(campaignId: string, rejectReason: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) throw new AppError(404, "Campaign tidak ditemukan");

  if (campaign.status !== "PENDING_REVIEW") {
    throw new AppError(
      422,
      "Hanya campaign berstatus PENDING_REVIEW yang bisa di-reject"
    );
  }

  return prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "REJECTED", rejectReason },
    select: {
      ...campaignPublicSelect,
      user: { select: { name: true, verificationStatus: true } },
    },
  });
}

export async function closeCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) throw new AppError(404, "Campaign tidak ditemukan");

  return prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "CLOSED" },
    select: {
      ...campaignPublicSelect,
      user: { select: { name: true, verificationStatus: true } },
    },
  });
}

export async function reportCampaign(
  userId: string,
  campaignId: string,
  reason: string
) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) throw new AppError(404, "Campaign tidak ditemukan");

  const existing = await prisma.report.findFirst({
    where: { userId, campaignId },
  });

  if (existing) throw new AppError(409, "Anda sudah melaporkan campaign ini");

  return prisma.report.create({
    data: { userId, campaignId, reason },
    select: { id: true, reason: true, createdAt: true },
  });
}

export async function recalculateCollectedAmount(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) throw new AppError(404, "Campaign tidak ditemukan");

  return prisma.$transaction(async (tx) => {
    const [donationAgg, withdrawalAgg] = await Promise.all([
      tx.donation.aggregate({
        where: { campaignId, status: "SUCCESS" },
        _sum: { amount: true },
      }),
      tx.withdrawal.aggregate({
        where: { campaignId, status: "PAID" },
        _sum: { amount: true },
      }),
    ]);

    const collectedAmount = donationAgg._sum.amount ?? 0;
    const availableBalance = collectedAmount - (withdrawalAgg._sum.amount ?? 0);

    return tx.campaign.update({
      where: { id: campaignId },
      data: { collectedAmount, availableBalance },
      select: { id: true, collectedAmount: true, availableBalance: true },
    });
  });
}
