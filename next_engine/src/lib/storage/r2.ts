import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export interface ObjectStore {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
}
let store: ObjectStore | undefined;
export function getObjectStore(): ObjectStore {
  if (store) return store;
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;
  if (!R2_ACCOUNT_ID || !/^[a-f0-9]{32}$/i.test(R2_ACCOUNT_ID) || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) throw new Error("R2 storage configuration is missing or invalid");
  const bucket = R2_BUCKET_NAME;
  const client = new S3Client({ region: "auto", endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY } });
  store = {
    async put(key, data, contentType) { await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data, ContentType: contentType })); },
    async get(key) { const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key })); if (!result.Body) throw new Error("Object body missing"); return result.Body.transformToByteArray(); },
    async delete(key) { await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })); },
  };
  return store;
}
