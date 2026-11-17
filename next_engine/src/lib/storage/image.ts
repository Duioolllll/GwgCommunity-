import sharp from "sharp";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 20_000_000;
const formats = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;
// 이 기능에서 생긴 오류의 종류와 원인을 다른 코드에 전달한다.
export class InvalidImageError extends Error {}

/** 지원하는 정지 이미지만 읽고 다시 저장한다. 촬영 정보처럼 불필요한 부가 정보는 기본적으로 제거한다. */
// 이미지 입력을 검증하고 안전한 이미지 데이터로 정리한다.
// 파일 크기와 실제 이미지 형식을 검사하고 안전한 이미지로 다시 저장할 내용을 만든다.
export async function sanitizeImage(input: Buffer, declaredType: string) {
  // 파일이 비어 있거나 5MB를 넘으면 이미지 처리를 시작하지 않는다.
  if (!input.length || input.length > MAX_IMAGE_BYTES) throw new InvalidImageError("이미지 크기는 5MB 이하여야 합니다.");
  // 아래 작업을 시도한다. 실패하면 추가 조건을 한 번 더 확인한다.
  try {
    const source = sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "warning", animated: true });
    const metadata = await source.metadata();
    const format = metadata.format as keyof typeof formats;
    // 실제 파일이 JPEG·PNG·WebP인지, 알려 준 형식과 같은지 확인한다. 움직이는 이미지, 크기를 읽을 수 없는 이미지, 2천만 픽셀을 넘는 이미지도 거절한다.
    if (!Object.hasOwn(formats, format) || formats[format] !== declaredType || (metadata.pages ?? 1) !== 1 || !metadata.width || !metadata.height || metadata.width * metadata.height > MAX_PIXELS) throw new InvalidImageError("JPEG, PNG 또는 WebP 정지 이미지만 허용됩니다.");
    const pipeline = source.rotate();
    // 원래 형식에 맞춰 이미지를 다시 저장한다. JPEG와 WebP는 품질을 85로 맞추고 PNG는 PNG 형식을 유지한다.
    const data = await (format === "jpeg" ? pipeline.jpeg({ quality: 85 }) : format === "png" ? pipeline.png() : pipeline.webp({ quality: 85 })).toBuffer();
    // 이미지를 다시 저장한 뒤에도 5MB를 넘으면 업로드를 허용하지 않는다.
    if (data.length > MAX_IMAGE_BYTES) throw new InvalidImageError("처리된 이미지가 5MB를 초과합니다.");
    return { data, contentType: formats[format] };
  } catch (error) {
    // 이미 준비한 이미지 오류 안내라면 그대로 전달한다. 다른 읽기 오류는 파일을 읽을 수 없다는 안내로 바꾼다.
    if (error instanceof InvalidImageError) throw error;
    throw new InvalidImageError("이미지 파일을 읽을 수 없습니다.");
  }
}
