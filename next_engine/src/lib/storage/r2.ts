/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export interface ObjectStore {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
}
let store: ObjectStore | undefined;
// 필수 R2 설정을 확인하고 S3 호환 객체 저장소 클라이언트를 재사용한다.
// 기능 `getObjectStore`(): `store` 조건을 추가로 검사한다.
export function getObjectStore(): ObjectStore {
  // 조건 `store`: 참이면 `store`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (store) return store;
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;
  // 조건 `!R2_ACCOUNT_ID || !/^[a-f0-9]{32}$/i.test(R2_ACCOUNT_ID) || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME`: 참이면 `new Error("R2 storage configuration is missing or invalid")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!R2_ACCOUNT_ID || !/^[a-f0-9]{32}$/i.test(R2_ACCOUNT_ID) || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY`: 거짓인 경우에만 오른쪽 `!R2_BUCKET_NAME`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!R2_ACCOUNT_ID || !/^[a-f0-9]{32}$/i.test(R2_ACCOUNT_ID) || !R2_ACCESS_KEY_ID`: 거짓인 경우에만 오른쪽 `!R2_SECRET_ACCESS_KEY`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!R2_ACCOUNT_ID || !/^[a-f0-9]{32}$/i.test(R2_ACCOUNT_ID)`: 거짓인 경우에만 오른쪽 `!R2_ACCESS_KEY_ID`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!R2_ACCOUNT_ID`: 거짓인 경우에만 오른쪽 `!/^[a-f0-9]{32}$/i.test(R2_ACCOUNT_ID)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!R2_ACCOUNT_ID || !/^[a-f0-9]{32}$/i.test(R2_ACCOUNT_ID) || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) throw new Error("R2 storage configuration is missing or invalid");
  const bucket = R2_BUCKET_NAME;
  const client = new S3Client({ region: "auto", endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY } });
  store = {
    // 기능 `put`(key, data, contentType): 먼저 `await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data, ContentType: contentType }));`를 실행한다.
    async put(key, data, contentType) { await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data, ContentType: contentType })); },
    // 기능 `get`(key): 먼저 `const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));`를 실행한다.
    // 조건 `!result.Body`: 참이면 `new Error("Object body missing")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    async get(key) { const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key })); if (!result.Body) throw new Error("Object body missing"); return result.Body.transformToByteArray(); },
    // 기능 `delete`(key): 먼저 `await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));`를 실행한다.
    async delete(key) { await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })); },
  };
  return store;
}
