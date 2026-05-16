import { AppError } from "./error";

export function validateFile(
  file: File,
  allowedTypes: string[],
  maxSizeBytes: number,
  label = "File"
): void {
  if (!allowedTypes.includes(file.type)) {
    const exts = allowedTypes
      .map((t) => t.split("/")[1].toUpperCase())
      .join(", ");
    throw new AppError(400, `Format ${label} tidak valid. Gunakan: ${exts}`);
  }

  if (file.size > maxSizeBytes) {
    const maxMB = maxSizeBytes / (1024 * 1024);
    throw new AppError(400, `Ukuran ${label} maksimal ${maxMB}MB`);
  }
}
