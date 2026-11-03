import sharp from "sharp";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 20_000_000;
const formats = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;
export class InvalidImageError extends Error {}

/** Decode and re-encode only supported still images, stripping metadata by default. */
export async function sanitizeImage(input: Buffer, declaredType: string) {
  if (!input.length || input.length > MAX_IMAGE_BYTES) throw new InvalidImageError("이미지 크기는 5MB 이하여야 합니다.");
  try {
    const source = sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "warning", animated: true });
    const metadata = await source.metadata();
    const format = metadata.format as keyof typeof formats;
    if (!Object.hasOwn(formats, format) || formats[format] !== declaredType || (metadata.pages ?? 1) !== 1 || !metadata.width || !metadata.height || metadata.width * metadata.height > MAX_PIXELS) throw new InvalidImageError("JPEG, PNG 또는 WebP 정지 이미지만 허용됩니다.");
    const pipeline = source.rotate();
    const data = await (format === "jpeg" ? pipeline.jpeg({ quality: 85 }) : format === "png" ? pipeline.png() : pipeline.webp({ quality: 85 })).toBuffer();
    if (data.length > MAX_IMAGE_BYTES) throw new InvalidImageError("처리된 이미지가 5MB를 초과합니다.");
    return { data, contentType: formats[format] };
  } catch (error) {
    if (error instanceof InvalidImageError) throw error;
    throw new InvalidImageError("이미지 파일을 읽을 수 없습니다.");
  }
}
