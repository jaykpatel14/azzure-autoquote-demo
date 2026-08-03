import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type QuotePdfStorageInput = {
  key: string;
  buffer: Buffer;
  contentType?: string;
};

const s3Clients = new Map<string, S3Client>();

export function getQuotePdfBucketName() {
  return process.env.S3_BUCKET?.trim() || null;
}

function getAwsRegion() {
  return process.env.AWS_REGION?.trim() || process.env.AWS_DEFAULT_REGION?.trim() || "us-east-1";
}

function getS3Client() {
  const region = getAwsRegion();
  const cached = s3Clients.get(region);
  if (cached) {
    return cached;
  }

  const client = new S3Client({ region });
  s3Clients.set(region, client);
  return client;
}

export function buildQuotePdfStorageKey(companyId: string, quoteNumber: string) {
  const safeQuoteNumber = quoteNumber.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return `quotes/${companyId}/${safeQuoteNumber}.pdf`;
}

export async function storeQuotePdfInS3({ key, buffer, contentType = "application/pdf" }: QuotePdfStorageInput) {
  const bucket = getQuotePdfBucketName();
  if (!bucket) {
    return null;
  }

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType
    })
  );

  return { bucket, key };
}

export async function loadQuotePdfFromS3(key: string) {
  const bucket = getQuotePdfBucketName();
  if (!bucket) {
    return null;
  }

  const response = await getS3Client().send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key
    })
  );

  const body = response.Body;
  if (!body || typeof body !== "object" || !("transformToByteArray" in body)) {
    return null;
  }

  const bytes = await body.transformToByteArray();
  return Buffer.from(bytes);
}

export async function deleteQuotePdfFromS3(key: string) {
  const bucket = getQuotePdfBucketName();
  if (!bucket) {
    return null;
  }

  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key
    })
  );

  return { bucket, key };
}
