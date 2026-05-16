export const PLATFORM_FEE_PERCENT: number =
  Number(process.env.PLATFORM_FEE_PERCENT) || 5;
export const WITHDRAWAL_ADMIN_FEE: number =
  Number(process.env.WITHDRAWAL_ADMIN_FEE) || 5000;
export const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || "7d";
export const ALLOWED_KTP_TYPES = ["image/jpeg", "image/png"];
export const MAX_KTP_SIZE = 5 * 1024 * 1024; // 5MB
export const BUCKETS = {
  KTP: "ktp",
  AVATAR: "avatar",
  CAMPAIGN_IMAGES: "campaign-images",
  CAMPAIGN_DOCS: "campaign-docs",
  WITHDRAWAL_PROOF: "withdrawal-proof",
} as const;
export const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png"];
export const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB
export const ALLOWED_DOC_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
export const MAX_DOC_SIZE = 10 * 1024 * 1024; // 10MB
