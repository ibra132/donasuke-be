import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diset"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET minimal 32 karakter"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  SUPABASE_URL: z.string().url("SUPABASE_URL harus berupa URL valid"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY wajib diset"),
  MIDTRANS_SERVER_KEY: z.string().min(1, "MIDTRANS_SERVER_KEY wajib diset"),
  MIDTRANS_CLIENT_KEY: z.string().min(1, "MIDTRANS_CLIENT_KEY wajib diset"),
  MIDTRANS_IS_PRODUCTION: z.enum(["true", "false"]).default("false"),
  PLATFORM_FEE_PERCENT: z.coerce.number().positive().default(5),
  WITHDRAWAL_ADMIN_FEE: z.coerce.number().positive().default(5000),
  PORT: z.coerce.number().positive().default(3001),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("❌ Environment variables tidak valid:");
  result.error.issues.forEach((issue) => {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  });
  process.exit(1);
}

export const env = result.data;
