import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export interface ObjectStore {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
}
let store: ObjectStore | undefined;
// 필수 R2 설정을 확인하고 S3 호환 객체 저장소 클라이언트를 재사용한다.
// 이미지를 넣고 꺼낼 Cloudflare R2 저장소에 연결한다.
export function getObjectStore(): ObjectStore {
  // 확인할 조건: 파일 저장소 있음 또는 true. 해당하면 파일 저장소을 돌려준다.
  if (store) return store;
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;
  // R2 계정 번호·접속 키·버킷 이름을 모두 설정했는지 확인한다. 빠졌거나 형식이 틀리면 파일 저장을 시작하지 않는다.
  if (!R2_ACCOUNT_ID || !/^[a-f0-9]{32}$/i.test(R2_ACCOUNT_ID) || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) throw new Error("R2 storage configuration is missing or invalid");
  const bucket = R2_BUCKET_NAME;
  const client = new S3Client({ region: "auto", endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY } });
  store = {
    // 이미지 파일을 R2 저장소에 올린다.
    async put(key, data, contentType) { await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data, ContentType: contentType })); },
    // R2에 저장된 이미지 파일을 읽어 온다.
    // 확인할 조건: 처리 결과의 Body 없음 또는 false. 해당하면 오류를 알려서 이 요청의 처리를 중단한다.
    async get(key) { const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key })); if (!result.Body) throw new Error("Object body missing"); return result.Body.transformToByteArray(); },
    // R2에서 해당 이미지 파일을 지운다.
    async delete(key) { await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })); },
  };
  return store;
}
