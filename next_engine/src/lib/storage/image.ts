/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import sharp from "sharp";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 20_000_000;
const formats = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;
export class InvalidImageError extends Error {}

/** Decode and re-encode only supported still images, stripping metadata by default. */
// 이미지 입력을 검증하고 안전한 이미지 데이터로 정리한다.
// 기능 `sanitizeImage`(input, declaredType): `!input.length || input.length > MAX_IMAGE_BYTES` 조건을 추가로 검사한다.
export async function sanitizeImage(input: Buffer, declaredType: string) {
  // 조건 `!input.length || input.length > MAX_IMAGE_BYTES`: 참이면 `new InvalidImageError("이미지 크기는 5MB 이하여야 합니다.")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!input.length`: 거짓인 경우에만 오른쪽 `input.length > MAX_IMAGE_BYTES`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!input.length || input.length > MAX_IMAGE_BYTES) throw new InvalidImageError("이미지 크기는 5MB 이하여야 합니다.");
  // 예외 처리: 본문 실행 중 예외가 발생하면 `error instanceof InvalidImageError` 조건을 추가로 검사한다.
  try {
    const source = sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "warning", animated: true });
    const metadata = await source.metadata();
    const format = metadata.format as keyof typeof formats;
    // 조건 `!Object.hasOwn(formats, format) || formats[format] !== declaredType || (metadata.pages ?? 1) !== 1 || !metadata.width || !metadata.height || metadata.width * metadata.height > MAX_PIXELS`: 참이면 `new InvalidImageError("JPEG, PNG 또는 WebP 정지 이미지만 허용됩니다.")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    // 단락 분기 `!Object.hasOwn(formats, format) || formats[format] !== declaredType || (metadata.pages ?? 1) !== 1 || !metadata.width || !metadata.height`: 거짓인 경우에만 오른쪽 `metadata.width * metadata.height > MAX_PIXELS`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    // 단락 분기 `!Object.hasOwn(formats, format) || formats[format] !== declaredType || (metadata.pages ?? 1) !== 1 || !metadata.width`: 거짓인 경우에만 오른쪽 `!metadata.height`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    // 단락 분기 `!Object.hasOwn(formats, format) || formats[format] !== declaredType || (metadata.pages ?? 1) !== 1`: 거짓인 경우에만 오른쪽 `!metadata.width`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    // 단락 분기 `!Object.hasOwn(formats, format) || formats[format] !== declaredType`: 거짓인 경우에만 오른쪽 `(metadata.pages ?? 1) !== 1`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    // 단락 분기 `!Object.hasOwn(formats, format)`: 거짓인 경우에만 오른쪽 `formats[format] !== declaredType`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    // 단락 분기 `metadata.pages`: null 또는 undefined인 경우에만 오른쪽 `1`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    if (!Object.hasOwn(formats, format) || formats[format] !== declaredType || (metadata.pages ?? 1) !== 1 || !metadata.width || !metadata.height || metadata.width * metadata.height > MAX_PIXELS) throw new InvalidImageError("JPEG, PNG 또는 WebP 정지 이미지만 허용됩니다.");
    const pipeline = source.rotate();
    // 선택 조건 `format === "jpeg"`: 참이면 `pipeline.jpeg({ quality: 85 })`, 거짓이면 `format === "png" ? pipeline.png() : pipeline.webp({ quality: 85 })`를 사용한다.
    // 선택 조건 `format === "png"`: 참이면 `pipeline.png()`, 거짓이면 `pipeline.webp({ quality: 85 })`를 사용한다.
    const data = await (format === "jpeg" ? pipeline.jpeg({ quality: 85 }) : format === "png" ? pipeline.png() : pipeline.webp({ quality: 85 })).toBuffer();
    // 조건 `data.length > MAX_IMAGE_BYTES`: 참이면 `new InvalidImageError("처리된 이미지가 5MB를 초과합니다.")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (data.length > MAX_IMAGE_BYTES) throw new InvalidImageError("처리된 이미지가 5MB를 초과합니다.");
    return { data, contentType: formats[format] };
  } catch (error) {
    // 조건 `error instanceof InvalidImageError`: 참이면 `error` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (error instanceof InvalidImageError) throw error;
    throw new InvalidImageError("이미지 파일을 읽을 수 없습니다.");
  }
}
